import { Router } from 'express';
import pool from '../db/connection.js';
import { loginLimiter } from '../middleware/rateLimit.js';

const router = Router();

// POST /auth/login — email + password
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [users] = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, role, can_login FROM users WHERE email = ? AND can_login = TRUE',
      [email.toLowerCase().trim()]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const bcrypt = await import('bcrypt');
    const valid = await bcrypt.default.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.userId = user.id;

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
