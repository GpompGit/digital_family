import pool from '../db/connection.js';

export default async function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const [[user]] = await pool.query(
      'SELECT role FROM users WHERE id = ?',
      [req.session.userId]
    );

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (err) {
    console.error('Admin check error:', err.message);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}
