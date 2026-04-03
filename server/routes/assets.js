import { Router } from 'express';
import pool from '../db/connection.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();

// GET /api/assets — list all assets with their attributes (for dropdowns and filters)
router.get('/', requireAuth, async (req, res) => {
  try {
    const [assets] = await pool.query(
      `SELECT a.id, a.name, a.slug, a.asset_type, a.owner_id, a.notes, a.created_at,
              u.first_name AS owner_first_name, u.last_name AS owner_last_name
       FROM assets a
       JOIN users u ON a.owner_id = u.id
       ORDER BY a.name`
    );

    // Fetch attributes for all assets in one query
    if (assets.length > 0) {
      const assetIds = assets.map(a => a.id);
      const [attrs] = await pool.query(
        'SELECT asset_id, attribute_name, attribute_value FROM asset_attributes WHERE asset_id IN (?)',
        [assetIds]
      );

      // Group attributes by asset_id
      const attrMap = {};
      for (const attr of attrs) {
        if (!attrMap[attr.asset_id]) attrMap[attr.asset_id] = {};
        attrMap[attr.asset_id][attr.attribute_name] = attr.attribute_value;
      }

      // Attach attributes to each asset
      for (const asset of assets) {
        asset.attributes = attrMap[asset.id] || {};
      }
    }

    res.json(assets);
  } catch (err) {
    console.error('Assets list error:', err.message);
    res.status(500).json({ error: 'Failed to load assets' });
  }
});

export default router;
