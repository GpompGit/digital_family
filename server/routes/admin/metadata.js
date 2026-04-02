import { Router } from 'express';
import pool from '../../db/connection.js';
import requireAdmin from '../../middleware/requireAdmin.js';

const router = Router();

// ============================================================
// Categories
// ============================================================

router.get('/categories', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, slug FROM categories ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('Admin categories error:', err.message);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

router.post('/categories', requireAdmin, async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });

    const [result] = await pool.query(
      'INSERT INTO categories (name, slug) VALUES (?, ?)', [name, slug]
    );
    res.status(201).json({ id: result.insertId, message: 'Category created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Category already exists' });
    console.error('Admin create category error:', err.message);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', requireAdmin, async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });

    const [result] = await pool.query(
      'UPDATE categories SET name = ?, slug = ? WHERE id = ?', [name, slug, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Category already exists' });
    console.error('Admin update category error:', err.message);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Category is in use by documents' });
    }
    console.error('Admin delete category error:', err.message);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ============================================================
// Institutions
// ============================================================

router.get('/institutions', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, slug, created_at FROM institutions ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('Admin institutions error:', err.message);
    res.status(500).json({ error: 'Failed to load institutions' });
  }
});

router.post('/institutions', requireAdmin, async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });

    const [result] = await pool.query(
      'INSERT INTO institutions (name, slug) VALUES (?, ?)', [name, slug]
    );
    res.status(201).json({ id: result.insertId, message: 'Institution created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Institution already exists' });
    console.error('Admin create institution error:', err.message);
    res.status(500).json({ error: 'Failed to create institution' });
  }
});

router.put('/institutions/:id', requireAdmin, async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });

    const [result] = await pool.query(
      'UPDATE institutions SET name = ?, slug = ? WHERE id = ?', [name, slug, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Institution not found' });
    res.json({ message: 'Institution updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Institution already exists' });
    console.error('Admin update institution error:', err.message);
    res.status(500).json({ error: 'Failed to update institution' });
  }
});

router.delete('/institutions/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM institutions WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Institution not found' });
    res.json({ message: 'Institution deleted' });
  } catch (err) {
    console.error('Admin delete institution error:', err.message);
    res.status(500).json({ error: 'Failed to delete institution' });
  }
});

// ============================================================
// Tags
// ============================================================

router.get('/tags', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, slug, color, created_at FROM tags ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('Admin tags error:', err.message);
    res.status(500).json({ error: 'Failed to load tags' });
  }
});

router.post('/tags', requireAdmin, async (req, res) => {
  try {
    const { name, slug, color } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });

    const [result] = await pool.query(
      'INSERT INTO tags (name, slug, color) VALUES (?, ?, ?)', [name, slug, color || '#6B7280']
    );
    res.status(201).json({ id: result.insertId, message: 'Tag created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Tag already exists' });
    console.error('Admin create tag error:', err.message);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

router.put('/tags/:id', requireAdmin, async (req, res) => {
  try {
    const { name, slug, color } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });

    const [result] = await pool.query(
      'UPDATE tags SET name = ?, slug = ?, color = ? WHERE id = ?',
      [name, slug, color || '#6B7280', req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Tag not found' });
    res.json({ message: 'Tag updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Tag already exists' });
    console.error('Admin update tag error:', err.message);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

router.delete('/tags/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM tags WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Tag not found' });
    res.json({ message: 'Tag deleted' });
  } catch (err) {
    console.error('Admin delete tag error:', err.message);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// ============================================================
// Custom Field Definitions
// ============================================================

router.get('/custom-fields', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, slug, data_type, created_at FROM custom_field_definitions ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    console.error('Admin custom fields error:', err.message);
    res.status(500).json({ error: 'Failed to load custom fields' });
  }
});

router.post('/custom-fields', requireAdmin, async (req, res) => {
  try {
    const { name, slug, data_type } = req.body;
    if (!name || !slug || !data_type) {
      return res.status(400).json({ error: 'name, slug, and data_type are required' });
    }

    const [result] = await pool.query(
      'INSERT INTO custom_field_definitions (name, slug, data_type) VALUES (?, ?, ?)',
      [name, slug, data_type]
    );
    res.status(201).json({ id: result.insertId, message: 'Custom field created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Custom field already exists' });
    console.error('Admin create custom field error:', err.message);
    res.status(500).json({ error: 'Failed to create custom field' });
  }
});

router.put('/custom-fields/:id', requireAdmin, async (req, res) => {
  try {
    const { name, slug, data_type } = req.body;
    if (!name || !slug || !data_type) {
      return res.status(400).json({ error: 'name, slug, and data_type are required' });
    }

    const [result] = await pool.query(
      'UPDATE custom_field_definitions SET name = ?, slug = ?, data_type = ? WHERE id = ?',
      [name, slug, data_type, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Custom field not found' });
    res.json({ message: 'Custom field updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Custom field already exists' });
    console.error('Admin update custom field error:', err.message);
    res.status(500).json({ error: 'Failed to update custom field' });
  }
});

router.delete('/custom-fields/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM custom_field_definitions WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Custom field not found' });
    res.json({ message: 'Custom field deleted' });
  } catch (err) {
    console.error('Admin delete custom field error:', err.message);
    res.status(500).json({ error: 'Failed to delete custom field' });
  }
});

export default router;
