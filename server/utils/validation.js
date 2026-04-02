// =============================================================================
// validation.js — Input Validation Helpers
// =============================================================================
//
// Reusable validation functions for user input.
// Used across routes to enforce consistent rules.
// =============================================================================

/**
 * Validate password complexity.
 * Rules: minimum 8 characters, at least one letter and one number.
 * Returns null if valid, or an error message string if invalid.
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'Password must contain at least one letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null; // valid
}

/**
 * Validate that a file path doesn't escape the uploads directory.
 * Prevents path traversal attacks (e.g., "../../etc/passwd").
 * Returns true if the path is safe, false if it's suspicious.
 */
export function isSafeFilePath(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return false;
  // Block any path that tries to go up directories
  if (relativePath.includes('..')) return false;
  // Block absolute paths
  if (relativePath.startsWith('/')) return false;
  // Block null bytes (can bypass security checks in some systems)
  if (relativePath.includes('\0')) return false;
  return true;
}
