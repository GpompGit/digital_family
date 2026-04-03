// =============================================================================
// auth.js — Authentication Routes (Login, Logout, Session Status)
// =============================================================================
//
// This is the most security-critical file in the application.
// It handles how users prove their identity (authentication).
//
// SECURITY LAYERS (defense in depth):
//   1. Rate limiting — max 5 login attempts per 15 min per IP (rateLimit.js)
//   2. Honeypot — hidden form field that catches bots
//   3. Account lockout — 5 failed attempts per email → 15-min lockout
//   4. bcrypt — passwords are hashed, never stored in plain text
//   5. Constant error messages — don't reveal whether email exists or password is wrong
//   6. Audit logging — every attempt (success or failure) is logged with IP and reason
//
// WHY SAME ERROR FOR ALL FAILURES?
// We always return "Invalid email or password" whether the email doesn't exist,
// the password is wrong, or the account is disabled. This prevents "enumeration
// attacks" where an attacker can discover which emails are registered by checking
// if they get different error messages.
// =============================================================================

import { Router } from 'express';
import pool from '../db/connection.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

// =============================================================================
// ACCOUNT LOCKOUT — Track failed login attempts per email address
// =============================================================================
//
// This is an in-memory Map (not in the database) because:
//   - It's fast (no DB query needed to check lockout)
//   - It resets on server restart (acceptable for a family app)
//   - It's per-email, not per-IP (prevents locking out shared IPs)
//
// For a larger app, you'd store this in Redis or the database.
// =============================================================================

const failedAttempts = new Map();   // Map<email, { count: number, lastAttempt: timestamp }>
const LOCKOUT_THRESHOLD = 5;        // lock after 5 failed attempts
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // lock for 15 minutes

// Get the real client IP address. Behind Cloudflare Tunnel, the actual
// client IP is in the x-forwarded-for header, not req.ip.
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '0.0.0.0';
}

// Check if an email address is currently locked out
function checkLockout(email) {
  const record = failedAttempts.get(email);
  if (!record) return false;
  if (record.count >= LOCKOUT_THRESHOLD) {
    if (Date.now() - record.lastAttempt < LOCKOUT_DURATION_MS) {
      return true; // still within lockout window
    }
    // Lockout has expired — clear and allow retry
    failedAttempts.delete(email);
    return false;
  }
  return false;
}

// Record a failed login attempt for an email address
function recordFailedAttempt(email) {
  const record = failedAttempts.get(email) || { count: 0, lastAttempt: 0 };
  record.count += 1;
  record.lastAttempt = Date.now();
  failedAttempts.set(email, record);
}

// Clear failed attempts after successful login
function clearFailedAttempts(email) {
  failedAttempts.delete(email);
}

// =============================================================================
// POST /auth/login — Authenticate with email + password
// =============================================================================
//
// Flow:
//   1. Check honeypot (bot trap)
//   2. Validate input
//   3. Check account lockout
//   4. Look up user by email
//   5. Compare password hash with bcrypt
//   6. Create session on success
//   7. Log the attempt to audit trail
//
// The loginLimiter middleware runs BEFORE this handler to enforce rate limits.
// =============================================================================

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password, website } = req.body;
    const ip = getClientIp(req);

    // --- HONEYPOT CHECK ---
    // The login form has a hidden field called "website" that is invisible
    // to human users (via CSS). Bots that auto-fill all form fields will
    // put something in this field. If it has a value, we know it's a bot.
    // We return the SAME error as a normal login failure so the bot can't
    // tell it was caught.
    if (website) {
      console.warn(`Honeypot triggered from IP ${ip}, email: ${email}`);
      await logAudit(null, 'login', 'session', null, null, { reason: 'honeypot', email: email || 'unknown' }, ip);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Normalize email: lowercase + trim whitespace to prevent "User@Email.com" vs "user@email.com" mismatches
    const normalizedEmail = email.toLowerCase().trim();

    // --- LOCKOUT CHECK ---
    // If this email has too many recent failed attempts, block immediately
    // without even checking the password. This prevents brute-force attacks.
    if (checkLockout(normalizedEmail)) {
      await logAudit(null, 'login', 'session', null, null, { reason: 'locked_out', email: normalizedEmail }, ip);
      return res.status(429).json({ error: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.' });
    }

    // --- LOOK UP USER ---
    // We only look for users with can_login = TRUE (excludes pets and disabled accounts).
    // The ? placeholder prevents SQL injection — the value is sent separately
    // from the query, so an attacker can't manipulate the SQL.
    const [users] = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, role, can_login FROM users WHERE email = ? AND can_login = TRUE',
      [normalizedEmail]
    );

    // Email not found — record the failed attempt and return generic error
    if (users.length === 0) {
      recordFailedAttempt(normalizedEmail);
      await logAudit(null, 'login', 'session', null, null, { reason: 'unknown_email', email: normalizedEmail }, ip);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Account exists but has no password (shouldn't happen, but safety check)
    if (!user.password_hash) {
      recordFailedAttempt(normalizedEmail);
      await logAudit(user.id, 'login', 'session', null, null, { reason: 'no_password_hash' }, ip);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // --- PASSWORD VERIFICATION ---
    // bcrypt.compare() takes the plain-text password and the stored hash,
    // hashes the plain-text password with the same salt, and compares.
    // This is deliberately SLOW (~100ms) to make brute-force attacks expensive.
    // We use dynamic import because bcrypt is a native module.
    const bcrypt = await import('bcrypt');
    const valid = await bcrypt.default.compare(password, user.password_hash);

    if (!valid) {
      recordFailedAttempt(normalizedEmail);
      const record = failedAttempts.get(normalizedEmail);
      await logAudit(user.id, 'login', 'session', null, null, {
        reason: 'wrong_password',
        attempts: record?.count || 1
      }, ip);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // --- SUCCESS ---
    // Clear the lockout counter and create a session.
    // req.session.userId is how we track "this user is logged in" across requests.
    // express-session stores this in MariaDB and sends a cookie to the browser.
    clearFailedAttempts(normalizedEmail);
    req.session.userId = user.id;

    await logAudit(user.id, 'login', 'session', null, null, { success: true }, ip);

    // Return user info (never include password_hash in the response!)
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        can_login: user.can_login
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// =============================================================================
// POST /auth/logout — Destroy the session
// =============================================================================
// session.destroy() removes the session from MariaDB and clears the cookie.
// We log the logout event before destroying (using the userId from the session).
// =============================================================================

router.post('/logout', async (req, res) => {
  const userId = req.session?.userId || null;
  const ip = getClientIp(req);

  req.session.destroy(async (err) => {
    if (err) {
      console.error('Logout error:', err.message);
      return res.status(500).json({ error: 'Logout failed' });
    }
    await logAudit(userId, 'logout', 'session', null, null, null, ip);
    res.json({ message: 'Logged out' });
  });
});

// =============================================================================
// GET /auth/status — Check if the user is currently logged in
// =============================================================================
// Called by the frontend on every page load (AuthContext.tsx) to restore
// the user's login state. If the session cookie is valid and the user exists
// in the database, return their profile. Otherwise, return { authenticated: false }.
//
// This endpoint does NOT require authentication (no requireAuth middleware)
// because it's used to CHECK if the user is authenticated.
// =============================================================================

router.get('/status', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ authenticated: false });
  }

  try {
    const [users] = await pool.query(
      'SELECT id, email, first_name, last_name, role, can_login FROM users WHERE id = ?',
      [req.session.userId]
    );

    if (users.length === 0) {
      return res.json({ authenticated: false });
    }

    res.json({ authenticated: true, user: users[0] });
  } catch (err) {
    console.error('Status check error:', err.message);
    res.json({ authenticated: false });
  }
});

export default router;
