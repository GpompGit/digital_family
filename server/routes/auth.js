import { Router } from 'express';
import pool from '../db/connection.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

// In-memory failed login tracker (per email) — resets on server restart
const failedAttempts = new Map();
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '0.0.0.0';
}

function checkLockout(email) {
  const record = failedAttempts.get(email);
  if (!record) return false;
  if (record.count >= LOCKOUT_THRESHOLD) {
    if (Date.now() - record.lastAttempt < LOCKOUT_DURATION_MS) {
      return true; // still locked
    }
    // Lockout expired — reset
    failedAttempts.delete(email);
    return false;
  }
  return false;
}

function recordFailedAttempt(email) {
  const record = failedAttempts.get(email) || { count: 0, lastAttempt: 0 };
  record.count += 1;
  record.lastAttempt = Date.now();
  failedAttempts.set(email, record);
}

function clearFailedAttempts(email) {
  failedAttempts.delete(email);
}

// POST /auth/login — email + password with honeypot + lockout
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password, website } = req.body;
    const ip = getClientIp(req);

    // Honeypot — if the hidden field has a value, it's a bot
    if (website) {
      console.warn(`Honeypot triggered from IP ${ip}, email: ${email}`);
      await logAudit(null, 'login', 'session', null, null, { reason: 'honeypot', email: email || 'unknown' }, ip);
      // Return same error as normal failure — don't reveal the trap
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check account lockout
    if (checkLockout(normalizedEmail)) {
      await logAudit(null, 'login', 'session', null, null, { reason: 'locked_out', email: normalizedEmail }, ip);
      return res.status(429).json({ error: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.' });
    }

    const [users] = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, role, can_login FROM users WHERE email = ? AND can_login = TRUE',
      [normalizedEmail]
    );

    if (users.length === 0) {
      recordFailedAttempt(normalizedEmail);
      await logAudit(null, 'login', 'session', null, null, { reason: 'unknown_email', email: normalizedEmail }, ip);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    if (!user.password_hash) {
      recordFailedAttempt(normalizedEmail);
      await logAudit(user.id, 'login', 'session', null, null, { reason: 'no_password_hash' }, ip);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

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

    // Success — clear lockout counter
    clearFailedAttempts(normalizedEmail);

    req.session.userId = user.id;

    await logAudit(user.id, 'login', 'session', null, null, { success: true }, ip);

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

// POST /auth/logout
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

// GET /auth/status — check if logged in
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
