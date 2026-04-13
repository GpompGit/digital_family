import { Router } from 'express';
import pool from '../db/connection.js';
import requireAuth from '../middleware/requireAuth.js';
import { logAudit } from '../utils/audit.js';

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

// POST /api/institutions — any user can create a new institution
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const slug = name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const [result] = await pool.query(
      'INSERT IGNORE INTO institutions (name, slug) VALUES (?, ?)',
      [name.trim(), slug]
    );

    if (result.affectedRows === 0) {
      // Already exists — return the existing one
      const [[existing]] = await pool.query('SELECT id, name, slug FROM institutions WHERE slug = ?', [slug]);
      return res.json(existing);
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await logAudit(req.session.userId, 'create', 'institution', result.insertId, null, { name }, ip);

    res.status(201).json({ id: result.insertId, name: name.trim(), slug });
  } catch (err) {
    console.error('Create institution error:', err.message);
    res.status(500).json({ error: 'Failed to create institution' });
  }
});

export default router;
