import { Router } from 'express';
import pool from '../db/connection.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();

// GET /api/users/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, email, first_name, last_name, created_at FROM users WHERE id = ?',
      [req.session.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (err) {
    console.error('User profile error:', err.message);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// GET /api/users — list all family members (for person_name dropdown)
router.get('/', requireAuth, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, first_name, last_name FROM users ORDER BY first_name'
    );
    res.json(users);
  } catch (err) {
    console.error('Users list error:', err.message);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

export default router;
