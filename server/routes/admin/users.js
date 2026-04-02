import { Router } from 'express';
import pool from '../../db/connection.js';
import requireAdmin from '../../middleware/requireAdmin.js';

const router = Router();

// GET /api/admin/users — list all users
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, email, first_name, last_name, role, can_login, created_at FROM users ORDER BY id'
    );
    res.json(users);
  } catch (err) {
    console.error('Admin users list error:', err.message);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// POST /api/admin/users — create user
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { email, password, first_name, last_name, role, can_login } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'first_name and last_name are required' });
    }

    if (can_login && (!email || !password)) {
      return res.status(400).json({ error: 'Email and password are required for login-enabled users' });
    }

    let passwordHash = null;
    if (password) {
      const bcrypt = await import('bcrypt');
      passwordHash = await bcrypt.default.hash(password, 10);
    }

    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, can_login)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email || null, passwordHash, first_name, last_name, role || 'member', can_login ? 1 : 0]
    );

    res.status(201).json({ id: result.insertId, message: 'User created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('Admin create user error:', err.message);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/admin/users/:id — update user
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { email, first_name, last_name, role, can_login } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'first_name and last_name are required' });
    }

    const [result] = await pool.query(
      `UPDATE users SET email = ?, first_name = ?, last_name = ?, role = ?, can_login = ?
       WHERE id = ?`,
      [email || null, first_name, last_name, role || 'member', can_login ? 1 : 0, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('Admin update user error:', err.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// PUT /api/admin/users/:id/password — reset password
router.put('/:id/password', requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.default.hash(password, 10);

    const [result] = await pool.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('Admin reset password error:', err.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// DELETE /api/admin/users/:id — delete user
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (parseInt(req.params.id) === req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Admin delete user error:', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
