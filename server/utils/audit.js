// =============================================================================
// audit.js — Audit Trail Helper
// =============================================================================
//
// WHAT IS AN AUDIT TRAIL?
// An audit trail is a chronological record of everything that happens in the
// system: who did what, when, and from where. It's like a security camera
// for your application.
//
// Every significant action gets logged to the `audit_log` table:
//   - Login/logout attempts (including failed ones)
//   - Document uploads, edits, deletions, downloads
//   - Admin operations (user management, metadata changes)
//
// WHY IS THIS IMPORTANT?
//   - Security: detect unauthorized access or suspicious activity
//   - Accountability: know who changed what in a shared family system
//   - Debugging: understand what happened before a bug or data issue
//   - Compliance: some documents (insurance, contracts) need an access record
//
// FIRE-AND-FORGET PATTERN:
// Audit logging should NEVER block or fail the main operation. If writing
// the audit log fails, we log the error to console but don't crash the request.
// That's why the try/catch inside logAudit swallows errors.
//
// USAGE IN ROUTES:
//   await logAudit(req.session.userId, 'create', 'document', doc.id, doc.uuid, { title }, req.ip);
//   // Don't worry if this fails — the document was already saved
// =============================================================================

import pool from '../db/connection.js';

/**
 * Log an action to the audit_log table.
 *
 * @param {number|null} userId    — who performed the action (null for unauthenticated, e.g. failed login)
 * @param {string} action         — what happened: 'create', 'update', 'delete', 'login', 'logout', 'download'
 * @param {string} entityType     — what type of thing was affected: 'document', 'user', 'session', 'tag', etc.
 * @param {number|null} entityId  — the database ID of the affected entity (null if not applicable)
 * @param {string|null} entityUuid — the UUID of the entity, if it has one (documents have UUIDs)
 * @param {object|null} details   — extra context as JSON (e.g., { reason: 'wrong_password', attempts: 3 })
 * @param {string} ipAddress      — the client's IP address (from req.ip or x-forwarded-for header)
 */
export async function logAudit(userId, action, entityType, entityId, entityUuid, details, ipAddress) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, entity_uuid, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        entityType,
        entityId,
        entityUuid,
        details ? JSON.stringify(details) : null, // convert JS object to JSON string for the database
        ipAddress || '0.0.0.0'                     // fallback if IP is somehow missing
      ]
    );
  } catch (err) {
    // Don't throw — audit failures must not break the main operation
    console.error('Audit log write error:', err.message);
  }
}
