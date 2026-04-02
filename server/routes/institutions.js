import { Router } from 'express';
import pool from '../db/connection.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();

// GET /api/institutions — list all institutions (for dropdowns)
router.get('/', requireAuth, async (req, res) => {
  try {
    const [institutions] = await pool.query(
      'SELECT id, name, slug FROM institutions ORDER BY name'
    );
    res.json(institutions);
  } catch (err) {
    console.error('Institutions list error:', err.message);
    res.status(500).json({ error: 'Failed to load institutions' });
  }
});

export default router;
