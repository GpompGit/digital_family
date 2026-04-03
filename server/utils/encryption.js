// =============================================================================
// encryption.js — AES-256-GCM Encryption for Files and Text
// =============================================================================
//
// WHAT THIS PROTECTS AGAINST:
// "Encryption at rest" means data is encrypted when stored on disk/database.
// If someone steals the NAS hard drive, copies the database dump, or gets
// unauthorized access to the filesystem, they can't read encrypted documents.
// The data is only decrypted when a legitimate user requests it through the app.
//
// HOW IT WORKS:
// - AES-256-GCM is a symmetric encryption algorithm (same key encrypts and decrypts)
// - The master key comes from the ENCRYPTION_KEY environment variable (32 bytes)
// - Each document gets a unique random IV (Initialization Vector) — stored in the DB
// - GCM mode provides both confidentiality AND authentication (tamper detection)
//
// WHAT GETS ENCRYPTED (when is_encrypted = true):
// - The PDF file on disk (encrypted before saving, decrypted when streaming)
// - Database fields: title, notes, extracted_text (encrypted before INSERT)
//
// KEY MANAGEMENT:
// - The master key is in .env (ENCRYPTION_KEY) — never committed to git
// - If the key is lost, ALL encrypted documents are permanently unreadable
// - The key should be backed up separately from the data
// - For a family app, one master key is acceptable. Enterprise apps would use
//   per-user keys derived from passwords (more complex, but survives key rotation)
// =============================================================================

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;       // 16 bytes for AES
const AUTH_TAG_LENGTH = 16;  // 16 bytes for GCM authentication tag

/**
 * Get the master encryption key from environment.
 * Must be exactly 32 bytes (64 hex characters).
 */
function getMasterKey() {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be set (64 hex characters = 32 bytes). Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Generate a random IV (Initialization Vector).
 * Each encryption operation MUST use a unique IV — reusing an IV with the
 * same key completely breaks GCM security.
 * @returns {string} hex-encoded IV (32 hex chars = 16 bytes)
 */
export function generateIV() {
  return crypto.randomBytes(IV_LENGTH).toString('hex');
}

/**
 * Encrypt a text string (for database fields like title, notes).
 * Returns a string in the format: "authTag:ciphertext" (both hex-encoded).
 *
 * @param {string} plaintext — the text to encrypt
 * @param {string} ivHex — the document's IV (hex string)
 * @returns {string} — encrypted string ("authTag:ciphertext")
 */
export function encryptText(plaintext, ivHex) {
  if (!plaintext) return plaintext;
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${authTag}:${encrypted}`;
}

/**
 * Decrypt a text string (for database fields).
 *
 * @param {string} encryptedStr — the encrypted string ("authTag:ciphertext")
 * @param {string} ivHex — the document's IV (hex string)
 * @returns {string} — decrypted plaintext
 */
export function decryptText(encryptedStr, ivHex) {
  if (!encryptedStr || !encryptedStr.includes(':')) return encryptedStr;
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const [authTagHex, ciphertext] = encryptedStr.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Encrypt a file buffer (for PDF files).
 * Returns a Buffer containing: authTag (16 bytes) + ciphertext.
 *
 * @param {Buffer} plainBuffer — the file content
 * @param {string} ivHex — the document's IV (hex string)
 * @returns {Buffer} — encrypted file content
 */
export function encryptFile(plainBuffer, ivHex) {
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Prepend auth tag to ciphertext so we can extract it during decryption
  return Buffer.concat([authTag, encrypted]);
}

/**
 * Decrypt a file buffer.
 *
 * @param {Buffer} encryptedBuffer — encrypted content (authTag + ciphertext)
 * @param {string} ivHex — the document's IV (hex string)
 * @returns {Buffer} — decrypted file content
 */
export function decryptFile(encryptedBuffer, ivHex) {
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  // Extract auth tag from the beginning of the buffer
  const authTag = encryptedBuffer.subarray(0, AUTH_TAG_LENGTH);
  const ciphertext = encryptedBuffer.subarray(AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Check if encryption is configured (ENCRYPTION_KEY env var is set).
 * Used to gracefully handle cases where a user tries to encrypt but the key isn't configured.
 */
export function isEncryptionConfigured() {
  const keyHex = process.env.ENCRYPTION_KEY;
  return keyHex && keyHex.length === 64;
}
