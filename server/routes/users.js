// =============================================================================
// users.js — User Profile & Family Member Routes
// =============================================================================
//
// Two audiences:
//   1. "Me" routes — a user manages their OWN profile
//   2. "Family" routes — any family member can VIEW other members' profiles
//
// All changes are audit-logged so the family can see who changed what.
// =============================================================================

import { Router } from 'express';
import pool from '../db/connection.js';
import requireAuth from '../middleware/requireAuth.js';
import { logAudit } from '../utils/audit.js';
import { validatePassword } from '../utils/validation.js';

const router = Router();

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

// =============================================================================
// HELPER — Load a full user profile with all related data
// =============================================================================
async function loadFullProfile(userId) {
  const [[user]] = await pool.query(
    'SELECT id, email, first_name, last_name, role, can_login, birth_date, created_at FROM users WHERE id = ?',
    [userId]
  );
  if (!user) return null;

  const [addresses] = await pool.query(
    'SELECT id, label, street, city, state, zip, country, year_in, year_out FROM user_addresses WHERE user_id = ? ORDER BY year_in DESC',
    [userId]
  );

  const [contacts] = await pool.query(
    'SELECT id, contact_type, label, value, is_primary FROM user_contacts WHERE user_id = ? ORDER BY contact_type, is_primary DESC',
    [userId]
  );

  const [identityDocs] = await pool.query(
    'SELECT id, doc_type, doc_number, issuing_country, issue_date, expire_date, notes FROM user_identity_docs WHERE user_id = ? ORDER BY expire_date DESC',
    [userId]
  );

  const [attributes] = await pool.query(
    'SELECT id, attribute_name, attribute_value FROM user_attributes WHERE user_id = ? ORDER BY attribute_name',
    [userId]
  );

  return { ...user, addresses, contacts, identity_docs: identityDocs, attributes };
}

// =============================================================================
// GET /api/users/me — Current user's full profile
// =============================================================================
router.get('/me', requireAuth, async (req, res) => {
  try {
    const profile = await loadFullProfile(req.session.userId);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    res.json(profile);
  } catch (err) {
    console.error('User profile error:', err.message);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// =============================================================================
// PUT /api/users/me — Update own basic profile (name, birth_date)
// =============================================================================
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { first_name, last_name, birth_date } = req.body;
    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'first_name and last_name are required' });
    }

    await pool.query(
      'UPDATE users SET first_name = ?, last_name = ?, birth_date = ? WHERE id = ?',
      [first_name, last_name, birth_date || null, req.session.userId]
    );

    await logAudit(req.session.userId, 'update', 'user', req.session.userId, null, { first_name, last_name, birth_date }, getIp(req));
    res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// =============================================================================
// PUT /api/users/me/password — Change own password
// =============================================================================
router.put('/me/password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const passwordError = validatePassword(new_password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const [[user]] = await pool.query(
      'SELECT password_hash FROM users WHERE id = ?', [req.session.userId]
    );

    const bcrypt = await import('bcrypt');
    const valid = await bcrypt.default.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.default.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.session.userId]);

    await logAudit(req.session.userId, 'update', 'user', req.session.userId, null, { action: 'password_change' }, getIp(req));
    res.json({ message: 'Password changed' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// =============================================================================
// ADDRESSES — CRUD for current user's addresses
// =============================================================================
router.post('/me/addresses', requireAuth, async (req, res) => {
  try {
    const { label, street, city, state, zip, country, year_in, year_out } = req.body;
    if (!street || !city) return res.status(400).json({ error: 'street and city are required' });

    const [result] = await pool.query(
      'INSERT INTO user_addresses (user_id, label, street, city, state, zip, country, year_in, year_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.session.userId, label || 'home', street, city, state || null, zip || null, country || 'Switzerland', year_in || null, year_out || null]
    );

    await logAudit(req.session.userId, 'create', 'user_address', result.insertId, null, { street, city }, getIp(req));
    res.status(201).json({ id: result.insertId, message: 'Address added' });
  } catch (err) {
    console.error('Add address error:', err.message);
    res.status(500).json({ error: 'Failed to add address' });
  }
});

router.put('/me/addresses/:id', requireAuth, async (req, res) => {
  try {
    const { label, street, city, state, zip, country, year_in, year_out } = req.body;
    const [result] = await pool.query(
      'UPDATE user_addresses SET label = ?, street = ?, city = ?, state = ?, zip = ?, country = ?, year_in = ?, year_out = ? WHERE id = ? AND user_id = ?',
      [label || 'home', street, city, state || null, zip || null, country || 'Switzerland', year_in || null, year_out || null, req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Address not found' });

    await logAudit(req.session.userId, 'update', 'user_address', parseInt(req.params.id), null, { street, city }, getIp(req));
    res.json({ message: 'Address updated' });
  } catch (err) {
    console.error('Update address error:', err.message);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

router.delete('/me/addresses/:id', requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Address not found' });

    await logAudit(req.session.userId, 'delete', 'user_address', parseInt(req.params.id), null, null, getIp(req));
    res.json({ message: 'Address deleted' });
  } catch (err) {
    console.error('Delete address error:', err.message);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// =============================================================================
// CONTACTS — CRUD for current user's emails and phone numbers
// =============================================================================
router.post('/me/contacts', requireAuth, async (req, res) => {
  try {
    const { contact_type, label, value, is_primary } = req.body;
    if (!contact_type || !value) return res.status(400).json({ error: 'contact_type and value are required' });

    const [result] = await pool.query(
      'INSERT INTO user_contacts (user_id, contact_type, label, value, is_primary) VALUES (?, ?, ?, ?, ?)',
      [req.session.userId, contact_type, label || 'personal', value, is_primary ? 1 : 0]
    );

    await logAudit(req.session.userId, 'create', 'user_contact', result.insertId, null, { contact_type, value }, getIp(req));
    res.status(201).json({ id: result.insertId, message: 'Contact added' });
  } catch (err) {
    console.error('Add contact error:', err.message);
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

router.put('/me/contacts/:id', requireAuth, async (req, res) => {
  try {
    const { contact_type, label, value, is_primary } = req.body;
    const [result] = await pool.query(
      'UPDATE user_contacts SET contact_type = ?, label = ?, value = ?, is_primary = ? WHERE id = ? AND user_id = ?',
      [contact_type, label || 'personal', value, is_primary ? 1 : 0, req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Contact not found' });

    await logAudit(req.session.userId, 'update', 'user_contact', parseInt(req.params.id), null, { contact_type, value }, getIp(req));
    res.json({ message: 'Contact updated' });
  } catch (err) {
    console.error('Update contact error:', err.message);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

router.delete('/me/contacts/:id', requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM user_contacts WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Contact not found' });

    await logAudit(req.session.userId, 'delete', 'user_contact', parseInt(req.params.id), null, null, getIp(req));
    res.json({ message: 'Contact deleted' });
  } catch (err) {
    console.error('Delete contact error:', err.message);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// =============================================================================
// IDENTITY DOCUMENTS — CRUD for passports, IDs, driver licenses
// =============================================================================
router.post('/me/identity-docs', requireAuth, async (req, res) => {
  try {
    const { doc_type, doc_number, issuing_country, issue_date, expire_date, notes } = req.body;
    if (!doc_type || !doc_number) return res.status(400).json({ error: 'doc_type and doc_number are required' });

    const [result] = await pool.query(
      'INSERT INTO user_identity_docs (user_id, doc_type, doc_number, issuing_country, issue_date, expire_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.session.userId, doc_type, doc_number, issuing_country || null, issue_date || null, expire_date || null, notes || null]
    );

    await logAudit(req.session.userId, 'create', 'user_identity_doc', result.insertId, null, { doc_type }, getIp(req));
    res.status(201).json({ id: result.insertId, message: 'Identity document added' });
  } catch (err) {
    console.error('Add identity doc error:', err.message);
    res.status(500).json({ error: 'Failed to add identity document' });
  }
});

router.put('/me/identity-docs/:id', requireAuth, async (req, res) => {
  try {
    const { doc_type, doc_number, issuing_country, issue_date, expire_date, notes } = req.body;
    const [result] = await pool.query(
      'UPDATE user_identity_docs SET doc_type = ?, doc_number = ?, issuing_country = ?, issue_date = ?, expire_date = ?, notes = ? WHERE id = ? AND user_id = ?',
      [doc_type, doc_number, issuing_country || null, issue_date || null, expire_date || null, notes || null, req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Identity document not found' });

    await logAudit(req.session.userId, 'update', 'user_identity_doc', parseInt(req.params.id), null, { doc_type }, getIp(req));
    res.json({ message: 'Identity document updated' });
  } catch (err) {
    console.error('Update identity doc error:', err.message);
    res.status(500).json({ error: 'Failed to update identity document' });
  }
});

router.delete('/me/identity-docs/:id', requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM user_identity_docs WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Identity document not found' });

    await logAudit(req.session.userId, 'delete', 'user_identity_doc', parseInt(req.params.id), null, null, getIp(req));
    res.json({ message: 'Identity document deleted' });
  } catch (err) {
    console.error('Delete identity doc error:', err.message);
    res.status(500).json({ error: 'Failed to delete identity document' });
  }
});

// =============================================================================
// KEY-VALUE ATTRIBUTES — AHV number, tax number, etc. (simple single values)
// =============================================================================
router.put('/me/attributes', requireAuth, async (req, res) => {
  try {
    const { attributes } = req.body;
    if (!attributes || typeof attributes !== 'object') {
      return res.status(400).json({ error: 'attributes object is required' });
    }

    // Replace all: delete existing, then insert new
    await pool.query('DELETE FROM user_attributes WHERE user_id = ?', [req.session.userId]);
    for (const [key, value] of Object.entries(attributes)) {
      if (key && value) {
        await pool.query(
          'INSERT INTO user_attributes (user_id, attribute_name, attribute_value) VALUES (?, ?, ?)',
          [req.session.userId, key, String(value)]
        );
      }
    }

    await logAudit(req.session.userId, 'update', 'user_attributes', req.session.userId, null, { keys: Object.keys(attributes) }, getIp(req));
    res.json({ message: 'Attributes updated' });
  } catch (err) {
    console.error('Update attributes error:', err.message);
    res.status(500).json({ error: 'Failed to update attributes' });
  }
});

// =============================================================================
// GET /api/users — List all family members (for dropdowns)
// =============================================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, first_name, last_name, role, can_login, birth_date FROM users ORDER BY first_name'
    );
    res.json(users);
  } catch (err) {
    console.error('Users list error:', err.message);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// =============================================================================
// GET /api/users/:id/profile — View any family member's full profile
// Family members can see each other's data (shared family system)
// =============================================================================
router.get('/:id/profile', requireAuth, async (req, res) => {
  try {
    const profile = await loadFullProfile(parseInt(req.params.id));
    if (!profile) return res.status(404).json({ error: 'User not found' });

    // Don't expose password_hash (it's not in the query, but be explicit)
    res.json(profile);
  } catch (err) {
    console.error('Family member profile error:', err.message);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

export default router;
