import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import pool from '../db/connection.js';
import requireAuth from '../middleware/requireAuth.js';
import { isSafeFilePath } from '../utils/validation.js';
import { logAudit } from '../utils/audit.js';
import { upload, getFilePath, buildDocumentPath, ensureDir, removeEmptyDir } from '../utils/fileStorage.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { encryptFile, decryptFile, encryptText, decryptText, generateIV, isEncryptionConfigured } from '../utils/encryption.js';

const router = Router();

/**
 * Insert custom field values for a document.
 * Accepts an object like { "amount": 127.50, "paid-date": "2024-03-15", "invoice-number": "INV-001" }
 * Keys are custom_field_definitions slugs, values are the field values.
 * If encryptionIv is set, string values are encrypted.
 */
async function insertCustomFields(documentId, fields, encryptionIv = null) {
  const [definitions] = await pool.query('SELECT id, slug, data_type FROM custom_field_definitions');
  const defMap = new Map(definitions.map(d => [d.slug, d]));

  for (const [slug, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === '') continue;
    const def = defMap.get(slug);
    if (!def) continue;

    const row = { document_id: documentId, field_id: def.id, value_string: null, value_date: null, value_integer: null, value_boolean: null, value_decimal: null };
    switch (def.data_type) {
      case 'string':
      case 'url':
        row.value_string = encryptionIv ? encryptText(String(value), encryptionIv) : String(value);
        break;
      case 'date':
        row.value_date = value;
        break;
      case 'integer':
        row.value_integer = parseInt(value);
        break;
      case 'boolean':
        row.value_boolean = value ? 1 : 0;
        break;
      case 'monetary':
        row.value_decimal = parseFloat(value);
        break;
    }

    await pool.query(
      `INSERT INTO document_custom_fields (document_id, field_id, value_string, value_date, value_integer, value_boolean, value_decimal)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value_string = VALUES(value_string), value_date = VALUES(value_date),
         value_integer = VALUES(value_integer), value_boolean = VALUES(value_boolean), value_decimal = VALUES(value_decimal)`,
      [row.document_id, row.field_id, row.value_string, row.value_date, row.value_integer, row.value_boolean, row.value_decimal]
    );
  }
}

// Helper: decrypt sensitive metadata fields if the document is encrypted
function decryptDocumentMeta(doc) {
  if (!doc.is_encrypted || !doc.encryption_iv) return doc;
  try {
    if (doc.title) doc.title = decryptText(doc.title, doc.encryption_iv);
    if (doc.notes) doc.notes = decryptText(doc.notes, doc.encryption_iv);
    if (doc.extracted_text) doc.extracted_text = decryptText(doc.extracted_text, doc.encryption_iv);
  } catch (err) {
    console.error('Failed to decrypt document metadata:', err.message);
  }
  return doc;
}

// GET /api/documents — list with filters
router.get('/', requireAuth, async (req, res) => {
  try {
    const { category, person, institution, asset, tag, q, from, to, expiring_before, sort, page, limit } = req.query;

    let sql = `
      SELECT d.id, d.uuid, d.person_id, d.title,
             d.document_date, d.file_size, d.original_filename, d.notes,
             d.expires_at, d.reminder_sent, d.version, d.parent_uuid,
             d.is_encrypted, d.encryption_iv, d.is_private,
             d.created_at, d.updated_at,
             c.name AS category_name, c.slug AS category_slug,
             p.first_name AS person_first_name, p.last_name AS person_last_name,
             i.id AS institution_id, i.name AS institution_name,
             a.id AS asset_id, a.name AS asset_name, a.asset_type,
             u.first_name AS uploaded_by_first, u.last_name AS uploaded_by_last
      FROM documents d
      JOIN categories c ON d.category_id = c.id
      JOIN users u ON d.user_id = u.id
      JOIN users p ON d.person_id = p.id
      LEFT JOIN institutions i ON d.institution_id = i.id
      LEFT JOIN assets a ON d.asset_id = a.id
    `;

    const joins = [];
    const params = [];

    if (tag) {
      joins.push('JOIN document_tags dt ON d.id = dt.document_id JOIN tags t ON dt.tag_id = t.id');
    }

    // Privacy filter: private documents only visible to person_id
    sql += joins.join(' ') + ' WHERE (d.is_private = FALSE OR d.person_id = ?)';
    params.push(req.session.userId);

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

    if (asset) {
      sql += ' AND d.asset_id = ?';
      params.push(parseInt(asset));
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

    // Decrypt metadata for encrypted documents
    for (const doc of documents) decryptDocumentMeta(doc);

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
              d.is_encrypted, d.encryption_iv, d.is_private,
              d.created_at, d.updated_at,
              c.name AS category_name, c.slug AS category_slug, c.id AS category_id,
              p.first_name AS person_first_name, p.last_name AS person_last_name,
              i.id AS institution_id, i.name AS institution_name,
              a.id AS asset_id, a.name AS asset_name, a.asset_type,
              u.first_name AS uploaded_by_first, u.last_name AS uploaded_by_last
       FROM documents d
       JOIN categories c ON d.category_id = c.id
       JOIN users u ON d.user_id = u.id
       JOIN users p ON d.person_id = p.id
       LEFT JOIN institutions i ON d.institution_id = i.id
       LEFT JOIN assets a ON d.asset_id = a.id
       WHERE d.uuid = ?`,
      [req.params.uuid]
    );

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Privacy check: private documents only visible to person_id
    const doc = documents[0];
    if (doc.is_private && doc.person_id !== req.session.userId) {
      return res.status(403).json({ error: 'This document is private' });
    }

    // Decrypt metadata if encrypted
    decryptDocumentMeta(doc);

    // Load custom fields (invoice fields, etc.)
    const [customFields] = await pool.query(
      `SELECT cf.field_id, fd.name AS field_name, fd.slug AS field_slug, fd.data_type,
              cf.value_string, cf.value_date, cf.value_integer, cf.value_boolean, cf.value_decimal
       FROM document_custom_fields cf
       JOIN custom_field_definitions fd ON cf.field_id = fd.id
       WHERE cf.document_id = ?`,
      [doc.id]
    );

    // Decrypt custom field string values if encrypted
    if (doc.is_encrypted && doc.encryption_iv) {
      for (const cf of customFields) {
        if (cf.value_string && (cf.data_type === 'string' || cf.data_type === 'url')) {
          try { cf.value_string = decryptText(cf.value_string, doc.encryption_iv); } catch (_) { /* skip */ }
        }
      }
    }

    doc.custom_fields = customFields;

    // Load tags
    const [tags] = await pool.query(
      `SELECT t.id, t.name, t.slug, t.color
       FROM document_tags dt JOIN tags t ON dt.tag_id = t.id
       WHERE dt.document_id = ?`,
      [doc.id]
    );
    doc.tags = tags;

    res.json(doc);
  } catch (err) {
    console.error('Document detail error:', err.message);
    res.status(500).json({ error: 'Failed to load document' });
  }
});

// GET /api/documents/:uuid/file — stream PDF
router.get('/:uuid/file', requireAuth, async (req, res) => {
  try {
    const [documents] = await pool.query(
      'SELECT file_path, original_filename, is_encrypted, encryption_iv, is_private, person_id FROM documents WHERE uuid = ?',
      [req.params.uuid]
    );

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = documents[0];

    // Privacy check: private files only accessible to person_id
    if (doc.is_private && doc.person_id !== req.session.userId) {
      return res.status(403).json({ error: 'This document is private' });
    }

    if (!isSafeFilePath(doc.file_path)) {
      console.error('Suspicious file_path in database:', doc.file_path);
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const filePath = getFilePath(doc.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_filename}"`);

    // If encrypted, decrypt the file before streaming
    if (doc.is_encrypted && doc.encryption_iv) {
      const encryptedBuffer = fs.readFileSync(filePath);
      const decryptedBuffer = decryptFile(encryptedBuffer, doc.encryption_iv);
      res.setHeader('Content-Length', decryptedBuffer.length);
      res.end(decryptedBuffer);
    } else {
      fs.createReadStream(filePath).pipe(res);
    }
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

    const { person_id, category_id, title, institution_id, asset_id, document_date, notes, expires_at, is_encrypted, is_private } = req.body;

    if (!person_id || !category_id || !title) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'person_id, category_id, and title are required' });
    }

    // Parse boolean flags (form data sends strings)
    const wantEncrypted = is_encrypted === 'true' || is_encrypted === true;
    const wantPrivate = is_private === 'true' || is_private === true;

    if (wantEncrypted && !isEncryptionConfigured()) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Encryption is not configured on this server' });
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

    // Encrypt file and metadata if requested
    let encryptionIv = null;
    let dbTitle = title;
    let dbNotes = notes || null;

    if (wantEncrypted) {
      encryptionIv = generateIV();
      // Encrypt the PDF file on disk
      const plainBuffer = fs.readFileSync(absolutePath);
      const encryptedBuffer = encryptFile(plainBuffer, encryptionIv);
      fs.writeFileSync(absolutePath, encryptedBuffer);
      // Encrypt metadata fields
      dbTitle = encryptText(title, encryptionIv);
      if (dbNotes) dbNotes = encryptText(dbNotes, encryptionIv);
    }

    await pool.query(
      `INSERT INTO documents (uuid, user_id, person_id, category_id, title, institution_id, asset_id, document_date, file_path, file_size, original_filename, notes, expires_at, is_encrypted, encryption_iv, is_private)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, req.session.userId, person_id, category_id, dbTitle, institution_id || null, asset_id || null, document_date || null, relativePath, req.file.size, req.file.originalname, dbNotes, expires_at || null, wantEncrypted ? 1 : 0, encryptionIv, wantPrivate ? 1 : 0]
    );

    // Insert custom fields if provided (invoice fields: amount, paid_date, etc.)
    const customFields = req.body.custom_fields ? JSON.parse(req.body.custom_fields) : null;
    if (customFields && typeof customFields === 'object') {
      const [[{ docId }]] = await pool.query('SELECT id AS docId FROM documents WHERE uuid = ?', [uuid]);
      await insertCustomFields(docId, customFields, encryptionIv);
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await logAudit(req.session.userId, 'create', 'document', null, uuid, { title, person_id, category_id, is_encrypted: wantEncrypted, is_private: wantPrivate }, ip);

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
    const { person_id, category_id, title, institution_id, asset_id, document_date, notes, expires_at, custom_fields } = req.body;

    // Fetch current document
    const [[doc]] = await pool.query(
      'SELECT id, uuid, file_path, is_encrypted, encryption_iv FROM documents WHERE uuid = ?',
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
      `UPDATE documents SET person_id = ?, category_id = ?, title = ?, institution_id = ?, asset_id = ?,
       document_date = ?, notes = ?, expires_at = ?, file_path = ?
       WHERE uuid = ?`,
      [person_id, category_id, title, institution_id || null, asset_id || null, document_date || null, notes || null, expires_at || null, relativePath, req.params.uuid]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Update custom fields if provided
    if (custom_fields && typeof custom_fields === 'object') {
      // Delete existing custom fields and re-insert
      await pool.query('DELETE FROM document_custom_fields WHERE document_id = ?', [doc.id]);
      await insertCustomFields(doc.id, custom_fields, doc.is_encrypted ? doc.encryption_iv : null);
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
