import { Router } from 'express';
import pool from '../../db/connection.js';
import requireAdmin from '../../middleware/requireAdmin.js';

const router = Router();

// GET /api/admin/audit — list audit log entries (paginated)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { action, entity_type, user_id, from, to, page, limit } = req.query;

    let sql = `
      SELECT a.id, a.action, a.entity_type, a.entity_id, a.entity_uuid,
             a.details, a.ip_address, a.created_at,
             u.first_name AS user_first_name, u.last_name AS user_last_name
      FROM audit_log a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      sql += ' AND a.action = ?';
      params.push(action);
    }

    if (entity_type) {
      sql += ' AND a.entity_type = ?';
      params.push(entity_type);
    }

    if (user_id) {
      sql += ' AND a.user_id = ?';
      params.push(parseInt(user_id));
    }

    if (from) {
      sql += ' AND a.created_at >= ?';
      params.push(from);
    }

    if (to) {
      sql += ' AND a.created_at <= ?';
      params.push(to);
    }

    sql += ' ORDER BY a.created_at DESC';

    // Pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const countSql = sql.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) AS total FROM').replace(/ORDER BY .+/, '');
    const [countResult] = await pool.query(countSql, params);
    const total = countResult[0].total;

    sql += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [entries] = await pool.query(sql, params);

    res.json({
      entries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Admin audit log error:', err.message);
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

export default router;
