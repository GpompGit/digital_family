import { Router } from 'express';
import pool from '../db/connection.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();

// GET /api/categories
router.get('/', requireAuth, async (req, res) => {
  try {
    const [categories] = await pool.query(
      'SELECT id, name, slug FROM categories ORDER BY name'
    );
    res.json(categories);
  } catch (err) {
    console.error('Categories error:', err.message);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

export default router;
