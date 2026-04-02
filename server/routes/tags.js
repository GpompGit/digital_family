import { Router } from 'express';
import pool from '../db/connection.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();

// GET /api/tags — list all tags (for filter dropdowns)
router.get('/', requireAuth, async (req, res) => {
  try {
    const [tags] = await pool.query(
      'SELECT id, name, slug, color FROM tags ORDER BY name'
    );
    res.json(tags);
  } catch (err) {
    console.error('Tags list error:', err.message);
    res.status(500).json({ error: 'Failed to load tags' });
  }
});

export default router;
