import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import pool from '../db/connection.js';
import requireAuth from '../middleware/requireAuth.js';
import { isSafeFilePath } from '../utils/validation.js';
import { logAudit } from '../utils/audit.js';
import { upload, getFilePath, buildDocumentPath, ensureDir, removeEmptyDir } from '../utils/fileStorage.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

const router = Router();

// GET /api/documents — list with filters
router.get('/', requireAuth, async (req, res) => {
  try {
    const { category, person, institution, tag, q, from, to, expiring_before, sort, page, limit } = req.query;

    let sql = `
      SELECT d.id, d.uuid, d.person_id, d.title,
             d.document_date, d.file_size, d.original_filename, d.notes,
             d.expires_at, d.reminder_sent, d.version, d.parent_uuid,
             d.created_at, d.updated_at,
             c.name AS category_name, c.slug AS category_slug,
             p.first_name AS person_first_name, p.last_name AS person_last_name,
             i.id AS institution_id, i.name AS institution_name,
             u.first_name AS uploaded_by_first, u.last_name AS uploaded_by_last
      FROM documents d
      JOIN categories c ON d.category_id = c.id
      JOIN users u ON d.user_id = u.id
      JOIN users p ON d.person_id = p.id
      LEFT JOIN institutions i ON d.institution_id = i.id
    `;

    const joins = [];
    const params = [];

    if (tag) {
      joins.push('JOIN document_tags dt ON d.id = dt.document_id JOIN tags t ON dt.tag_id = t.id');
    }

    sql += joins.join(' ') + ' WHERE 1=1';

    if (category) {
      sql += ' AND c.slug = ?';
      params.push(category);
    }

    if (person) {
      sql += ' AND d.person_id = ?';
      params.push(parseInt(person));
    }

    if (institution) {
      sql += ' AND d.institution_id = ?';
      params.push(parseInt(institution));
    }

    if (tag) {
      sql += ' AND t.slug = ?';
      params.push(tag);
    }

    if (q) {
      sql += ' AND MATCH(d.title, d.extracted_text) AGAINST(? IN BOOLEAN MODE)';
      params.push(q);
    }

    if (from) {
      sql += ' AND d.document_date >= ?';
      params.push(from);
    }

    if (to) {
      sql += ' AND d.document_date <= ?';
      params.push(to);
    }

    if (expiring_before) {
      sql += ' AND d.expires_at IS NOT NULL AND d.expires_at <= ?';
      params.push(expiring_before);
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
      `SELECT d.id, d.uuid, d.user_id, d.person_id, d.title,
              d.document_date, d.file_size, d.original_filename, d.notes,
              d.expires_at, d.reminder_sent, d.version, d.parent_uuid,
              d.created_at, d.updated_at,
              c.name AS category_name, c.slug AS category_slug, c.id AS category_id,
              p.first_name AS person_first_name, p.last_name AS person_last_name,
              i.id AS institution_id, i.name AS institution_name,
              u.first_name AS uploaded_by_first, u.last_name AS uploaded_by_last
       FROM documents d
       JOIN categories c ON d.category_id = c.id
       JOIN users u ON d.user_id = u.id
       JOIN users p ON d.person_id = p.id
       LEFT JOIN institutions i ON d.institution_id = i.id
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

    // Defense-in-depth: validate the stored file path hasn't been tampered with
    if (!isSafeFilePath(documents[0].file_path)) {
      console.error('Suspicious file_path in database:', documents[0].file_path);
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const filePath = getFilePath(documents[0].file_path);

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

    const { person_id, category_id, title, institution_id, document_date, notes, expires_at } = req.body;

    if (!person_id || !category_id || !title) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'person_id, category_id, and title are required' });
    }

    const uuid = req.fileUuid;

    // Look up person, category, and institution for file path
    const [[person]] = await pool.query(
      'SELECT first_name, last_name FROM users WHERE id = ?', [person_id]
    );
    if (!person) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid person_id' });
    }

    const [[category]] = await pool.query(
      'SELECT slug FROM categories WHERE id = ?', [category_id]
    );
    if (!category) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid category_id' });
    }

    let institutionSlug = null;
    if (institution_id) {
      const [[inst]] = await pool.query(
        'SELECT slug FROM institutions WHERE id = ?', [institution_id]
      );
      if (!inst) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Invalid institution_id' });
      }
      institutionSlug = inst.slug;
    }

    // Build descriptive file path and move file
    const { relativePath, absolutePath, dirPath } = buildDocumentPath(
      person, category.slug, document_date || null, institutionSlug, title, uuid
    );
    ensureDir(dirPath);
    fs.renameSync(req.file.path, absolutePath);

    await pool.query(
      `INSERT INTO documents (uuid, user_id, person_id, category_id, title, institution_id, document_date, file_path, file_size, original_filename, notes, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, req.session.userId, person_id, category_id, title, institution_id || null, document_date || null, relativePath, req.file.size, req.file.originalname, notes || null, expires_at || null]
    );

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await logAudit(req.session.userId, 'create', 'document', null, uuid, { title, person_id, category_id }, ip);

    res.status(201).json({ uuid, message: 'Document uploaded' });
  } catch (err) {
    console.error('Upload error:', err.message);
    // Clean up temp file or final file on error
    if (req.file) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// PUT /api/documents/:uuid — update metadata (renames file if path-relevant fields change)
router.put('/:uuid', requireAuth, async (req, res) => {
  try {
    const { person_id, category_id, title, institution_id, document_date, notes, expires_at } = req.body;

    // Fetch current document
    const [[doc]] = await pool.query(
      'SELECT id, uuid, file_path FROM documents WHERE uuid = ?',
      [req.params.uuid]
    );
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Look up person, category, institution for new file path
    const [[person]] = await pool.query(
      'SELECT first_name, last_name FROM users WHERE id = ?', [person_id]
    );
    if (!person) {
      return res.status(400).json({ error: 'Invalid person_id' });
    }

    const [[category]] = await pool.query(
      'SELECT slug FROM categories WHERE id = ?', [category_id]
    );
    if (!category) {
      return res.status(400).json({ error: 'Invalid category_id' });
    }

    let institutionSlug = null;
    if (institution_id) {
      const [[inst]] = await pool.query(
        'SELECT slug FROM institutions WHERE id = ?', [institution_id]
      );
      if (!inst) {
        return res.status(400).json({ error: 'Invalid institution_id' });
      }
      institutionSlug = inst.slug;
    }

    // Build new file path
    const { relativePath, absolutePath, dirPath } = buildDocumentPath(
      person, category.slug, document_date || null, institutionSlug, title, doc.uuid
    );

    // Rename file on disk if path changed
    if (relativePath !== doc.file_path) {
      const oldAbsPath = getFilePath(doc.file_path);
      const oldDirPath = path.dirname(oldAbsPath);

      ensureDir(dirPath);
      if (fs.existsSync(oldAbsPath)) {
        fs.renameSync(oldAbsPath, absolutePath);
      }
      removeEmptyDir(oldDirPath);
    }

    const [result] = await pool.query(
      `UPDATE documents SET person_id = ?, category_id = ?, title = ?, institution_id = ?,
       document_date = ?, notes = ?, expires_at = ?, file_path = ?
       WHERE uuid = ?`,
      [person_id, category_id, title, institution_id || null, document_date || null, notes || null, expires_at || null, relativePath, req.params.uuid]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await logAudit(req.session.userId, 'update', 'document', null, req.params.uuid, { title, person_id, category_id }, ip);

    res.json({ message: 'Document updated' });
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// DELETE /api/documents/:uuid — only uploader or admin can delete
router.delete('/:uuid', requireAuth, async (req, res) => {
  try {
    const [documents] = await pool.query(
      'SELECT file_path, user_id FROM documents WHERE uuid = ?',
      [req.params.uuid]
    );

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check ownership: only the uploader or an admin can delete
    const [[currentUser]] = await pool.query(
      'SELECT role FROM users WHERE id = ?', [req.session.userId]
    );
    if (documents[0].user_id !== req.session.userId && currentUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Only the uploader or an admin can delete this document' });
    }

    // Delete file from disk
    const filePath = getFilePath(documents[0].file_path);
    const dirPath = path.dirname(filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    removeEmptyDir(dirPath);

    // Delete from database
    await pool.query('DELETE FROM documents WHERE uuid = ?', [req.params.uuid]);

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await logAudit(req.session.userId, 'delete', 'document', null, req.params.uuid, null, ip);

    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
