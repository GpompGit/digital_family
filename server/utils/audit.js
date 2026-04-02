import pool from '../db/connection.js';

/**
 * Log an action to the audit_log table.
 * @param {number|null} userId
 * @param {string} action - 'create'|'update'|'delete'|'login'|'logout'|'download'
 * @param {string} entityType - 'document'|'user'|'tag'|'category'|'institution'|'session'
 * @param {number|null} entityId
 * @param {string|null} entityUuid
 * @param {object|null} details
 * @param {string} ipAddress
 */
export async function logAudit(userId, action, entityType, entityId, entityUuid, details, ipAddress) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, entity_uuid, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId, entityUuid, details ? JSON.stringify(details) : null, ipAddress || '0.0.0.0']
    );
  } catch (err) {
    console.error('Audit log write error:', err.message);
  }
}
