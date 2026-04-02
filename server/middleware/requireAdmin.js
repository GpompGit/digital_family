// =============================================================================
// requireAdmin.js — Admin Authorization Middleware
// =============================================================================
//
// This middleware does TWO checks:
//   1. Is the user logged in? (same as requireAuth)
//   2. Does the user have the 'admin' role?
//
// This is "authorization" — not just "are you who you say you are?" (authentication)
// but "do you have PERMISSION to do this?" (authorization).
//
// We query the database on every request instead of trusting the session,
// because an admin could demote a user between requests. Always verify
// permissions from the source of truth (the database).
//
// USAGE: router.get('/admin-only', requireAdmin, handlerFunction)
//
// The double destructure [[user]] is a mysql2 pattern:
//   pool.query() returns [rows, fields]
//   rows is an array — [[user]] grabs the first row directly
//   If no rows match, user will be undefined
// =============================================================================

import pool from '../db/connection.js';

export default async function requireAdmin(req, res, next) {
  // Step 1: Check authentication (is user logged in?)
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Step 2: Look up the user's role in the database
    const [[user]] = await pool.query(
      'SELECT role FROM users WHERE id = ?',
      [req.session.userId]
    );

    // Step 3: Check authorization (is user an admin?)
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // User is authenticated AND authorized — continue
    next();
  } catch (err) {
    console.error('Admin check error:', err.message);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}
