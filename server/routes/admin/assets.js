import { Router } from 'express';
import pool from '../../db/connection.js';
import requireAdmin from '../../middleware/requireAdmin.js';
import { logAudit } from '../../utils/audit.js';

const router = Router();

// GET /api/admin/assets — list all assets with attributes
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [assets] = await pool.query(
      `SELECT a.id, a.name, a.slug, a.asset_type, a.owner_id, a.notes, a.created_at,
              u.first_name AS owner_first_name, u.last_name AS owner_last_name
       FROM assets a
       JOIN users u ON a.owner_id = u.id
       ORDER BY a.name`
    );

    if (assets.length > 0) {
      const assetIds = assets.map(a => a.id);
      const [attrs] = await pool.query(
        'SELECT asset_id, attribute_name, attribute_value FROM asset_attributes WHERE asset_id IN (?)',
        [assetIds]
      );
      const attrMap = {};
      for (const attr of attrs) {
        if (!attrMap[attr.asset_id]) attrMap[attr.asset_id] = {};
        attrMap[attr.asset_id][attr.attribute_name] = attr.attribute_value;
      }
      for (const asset of assets) {
        asset.attributes = attrMap[asset.id] || {};
      }
    }

    res.json(assets);
  } catch (err) {
    console.error('Admin assets list error:', err.message);
    res.status(500).json({ error: 'Failed to load assets' });
  }
});

// POST /api/admin/assets — create asset with attributes
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, slug, asset_type, owner_id, notes, attributes } = req.body;
    if (!name || !slug || !asset_type || !owner_id) {
      return res.status(400).json({ error: 'name, slug, asset_type, and owner_id are required' });
    }

    const [result] = await pool.query(
      'INSERT INTO assets (name, slug, asset_type, owner_id, notes) VALUES (?, ?, ?, ?, ?)',
      [name, slug, asset_type, owner_id, notes || null]
    );

    const assetId = result.insertId;

    // Insert attributes if provided (object: { brand: "Volvo", model: "XC60" })
    if (attributes && typeof attributes === 'object') {
      for (const [key, value] of Object.entries(attributes)) {
        if (key && value) {
          await pool.query(
            'INSERT INTO asset_attributes (asset_id, attribute_name, attribute_value) VALUES (?, ?, ?)',
            [assetId, key, String(value)]
          );
        }
      }
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await logAudit(req.session.userId, 'create', 'asset', assetId, null, { name, asset_type }, ip);

    res.status(201).json({ id: assetId, message: 'Asset created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Asset slug already exists' });
    console.error('Admin create asset error:', err.message);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// PUT /api/admin/assets/:id — update asset and its attributes
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, slug, asset_type, owner_id, notes, attributes } = req.body;
    if (!name || !slug || !asset_type || !owner_id) {
      return res.status(400).json({ error: 'name, slug, asset_type, and owner_id are required' });
    }

    const [result] = await pool.query(
      'UPDATE assets SET name = ?, slug = ?, asset_type = ?, owner_id = ?, notes = ? WHERE id = ?',
      [name, slug, asset_type, owner_id, notes || null, req.params.id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Asset not found' });

    // Replace attributes: delete all, then re-insert
    if (attributes && typeof attributes === 'object') {
      await pool.query('DELETE FROM asset_attributes WHERE asset_id = ?', [req.params.id]);
      for (const [key, value] of Object.entries(attributes)) {
        if (key && value) {
          await pool.query(
            'INSERT INTO asset_attributes (asset_id, attribute_name, attribute_value) VALUES (?, ?, ?)',
            [req.params.id, key, String(value)]
          );
        }
      }
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await logAudit(req.session.userId, 'update', 'asset', parseInt(req.params.id), null, { name, asset_type }, ip);

    res.json({ message: 'Asset updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Asset slug already exists' });
    console.error('Admin update asset error:', err.message);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// DELETE /api/admin/assets/:id — delete asset (documents keep person_id, lose asset_id)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM assets WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Asset not found' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await logAudit(req.session.userId, 'delete', 'asset', parseInt(req.params.id), null, null, ip);

    res.json({ message: 'Asset deleted' });
  } catch (err) {
    console.error('Admin delete asset error:', err.message);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// ============================================================
// User Attributes (manage attributes for persons/pets)
// ============================================================

// GET /api/admin/user-attributes/:userId — get attributes for a user
router.get('/user-attributes/:userId', requireAdmin, async (req, res) => {
  try {
    const [attrs] = await pool.query(
      'SELECT id, attribute_name, attribute_value FROM user_attributes WHERE user_id = ? ORDER BY attribute_name',
      [req.params.userId]
    );
    res.json(attrs);
  } catch (err) {
    console.error('User attributes error:', err.message);
    res.status(500).json({ error: 'Failed to load user attributes' });
  }
});

// PUT /api/admin/user-attributes/:userId — replace all attributes for a user
router.put('/user-attributes/:userId', requireAdmin, async (req, res) => {
  try {
    const { attributes } = req.body;
    if (!attributes || typeof attributes !== 'object') {
      return res.status(400).json({ error: 'attributes object is required' });
    }

    // Replace all: delete existing, then insert new
    await pool.query('DELETE FROM user_attributes WHERE user_id = ?', [req.params.userId]);
    for (const [key, value] of Object.entries(attributes)) {
      if (key && value) {
        await pool.query(
          'INSERT INTO user_attributes (user_id, attribute_name, attribute_value) VALUES (?, ?, ?)',
          [req.params.userId, key, String(value)]
        );
      }
    }

    res.json({ message: 'User attributes updated' });
  } catch (err) {
    console.error('Update user attributes error:', err.message);
    res.status(500).json({ error: 'Failed to update user attributes' });
  }
});

export default router;
