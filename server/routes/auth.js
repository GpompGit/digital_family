import { Router } from 'express';
import crypto from 'crypto';
import pool from '../db/connection.js';
import { sendMagicLink } from '../utils/email.js';
import { loginLimiter } from '../middleware/rateLimit.js';

const router = Router();

// POST /auth/login — send magic link
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [users] = await pool.query(
      'SELECT id, email FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (users.length === 0) {
      // Don't reveal whether the email exists
      return res.json({ message: 'If this email is registered, a login link has been sent' });
    }

    const user = users[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await pool.query(
      'INSERT INTO magic_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt]
    );

    await sendMagicLink(user.email, token);

    res.json({ message: 'If this email is registered, a login link has been sent' });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Failed to send login link' });
  }
});

// GET /auth/verify — verify magic link token
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const [tokens] = await pool.query(
      'SELECT id, user_id, used, expires_at FROM magic_tokens WHERE token = ?',
      [token]
    );

    if (tokens.length === 0) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    const magicToken = tokens[0];

    if (magicToken.used) {
      return res.status(400).json({ error: 'Token already used' });
    }

    if (new Date(magicToken.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Token expired' });
    }

    // Mark token as used
    await pool.query(
      'UPDATE magic_tokens SET used = TRUE WHERE id = ?',
      [magicToken.id]
    );

    // Create session
    req.session.userId = magicToken.user_id;

    // Redirect to app
    res.redirect('/');
  } catch (err) {
    console.error('Verify error:', err.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err.message);
      return res.status(500).json({ error: 'Logout failed' });
    }
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
      'SELECT id, email, first_name, last_name FROM users WHERE id = ?',
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
