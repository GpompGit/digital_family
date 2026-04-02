import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import pool from '../db/connection.js';
import requireAuth from '../middleware/requireAuth.js';
import { upload, getFilePath } from '../utils/fileStorage.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

const router = Router();

// GET /api/documents — list with filters
router.get('/', requireAuth, async (req, res) => {
  try {
    const { category, person, institution, q, from, to, sort, page, limit } = req.query;

    let sql = `
      SELECT d.id, d.uuid, d.person_name, d.title, d.institution,
             d.document_date, d.file_size, d.original_filename, d.notes,
             d.created_at, d.updated_at,
             c.name AS category_name, c.slug AS category_slug,
             u.first_name AS uploaded_by_first, u.last_name AS uploaded_by_last
      FROM documents d
      JOIN categories c ON d.category_id = c.id
      JOIN users u ON d.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      sql += ' AND c.slug = ?';
      params.push(category);
    }

    if (person) {
      sql += ' AND d.person_name = ?';
      params.push(person);
    }

    if (institution) {
      sql += ' AND d.institution LIKE ?';
      params.push(`%${institution}%`);
    }

    if (q) {
      sql += ' AND (d.title LIKE ? OR d.institution LIKE ? OR d.notes LIKE ?)';
      const search = `%${q}%`;
      params.push(search, search, search);
    }

    if (from) {
      sql += ' AND d.document_date >= ?';
      params.push(from);
    }

    if (to) {
      sql += ' AND d.document_date <= ?';
      params.push(to);
    }

    // Sorting
    switch (sort) {
      case 'date_asc':
        sql += ' ORDER BY d.document_date ASC';
        break;
      case 'title_asc':
        sql += ' ORDER BY d.title ASC';
        break;
      case 'created_desc':
        sql += ' ORDER BY d.created_at DESC';
        break;
      default:
        sql += ' ORDER BY d.document_date DESC';
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Count total
    const countSql = sql.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) AS total FROM').replace(/ORDER BY .+/, '');
    const [countResult] = await pool.query(countSql, params);
    const total = countResult[0].total;

    sql += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [documents] = await pool.query(sql, params);

    res.json({
      documents,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Documents list error:', err.message);
    res.status(500).json({ error: 'Failed to load documents' });
  }
});

// GET /api/documents/:uuid — single document metadata
router.get('/:uuid', requireAuth, async (req, res) => {
  try {
    const [documents] = await pool.query(
      `SELECT d.id, d.uuid, d.person_name, d.title, d.institution,
              d.document_date, d.file_size, d.original_filename, d.notes,
              d.created_at, d.updated_at,
              c.name AS category_name, c.slug AS category_slug, c.id AS category_id,
              u.first_name AS uploaded_by_first, u.last_name AS uploaded_by_last
       FROM documents d
       JOIN categories c ON d.category_id = c.id
       JOIN users u ON d.user_id = u.id
       WHERE d.uuid = ?`,
      [req.params.uuid]
    );

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(documents[0]);
  } catch (err) {
    console.error('Document detail error:', err.message);
    res.status(500).json({ error: 'Failed to load document' });
  }
});

// GET /api/documents/:uuid/file — stream PDF
router.get('/:uuid/file', requireAuth, async (req, res) => {
  try {
    const [documents] = await pool.query(
      'SELECT file_path, original_filename FROM documents WHERE uuid = ?',
      [req.params.uuid]
    );

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = getFilePath(req.params.uuid);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${documents[0].original_filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('File stream error:', err.message);
    res.status(500).json({ error: 'Failed to stream file' });
  }
});

// POST /api/documents — upload PDF + metadata
router.post('/', requireAuth, uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const { person_name, category_id, title, institution, document_date, notes } = req.body;

    if (!person_name || !category_id || !title) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'person_name, category_id, and title are required' });
    }

    const uuid = req.fileUuid;

    await pool.query(
      `INSERT INTO documents (uuid, user_id, person_name, category_id, title, institution, document_date, file_path, file_size, original_filename, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, req.session.userId, person_name, category_id, title, institution || null, document_date || null, `${uuid}.pdf`, req.file.size, req.file.originalname, notes || null]
    );

    res.status(201).json({ uuid, message: 'Document uploaded' });
  } catch (err) {
    console.error('Upload error:', err.message);
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// PUT /api/documents/:uuid — update metadata
router.put('/:uuid', requireAuth, async (req, res) => {
  try {
    const { person_name, category_id, title, institution, document_date, notes } = req.body;

    const [result] = await pool.query(
      `UPDATE documents SET person_name = ?, category_id = ?, title = ?, institution = ?, document_date = ?, notes = ?
       WHERE uuid = ?`,
      [person_name, category_id, title, institution || null, document_date || null, notes || null, req.params.uuid]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ message: 'Document updated' });
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// DELETE /api/documents/:uuid
router.delete('/:uuid', requireAuth, async (req, res) => {
  try {
    const [documents] = await pool.query(
      'SELECT file_path FROM documents WHERE uuid = ?',
      [req.params.uuid]
    );

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete file from disk
    const filePath = getFilePath(req.params.uuid);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await pool.query('DELETE FROM documents WHERE uuid = ?', [req.params.uuid]);

    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
