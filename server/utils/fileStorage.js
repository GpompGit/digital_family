// =============================================================================
// fileStorage.js — File Upload, Naming, and Path Management
// =============================================================================
//
// This module handles everything about where and how PDF files are stored:
//
//   1. MULTER CONFIGURATION — handles the HTTP file upload (multipart/form-data)
//   2. SLUG GENERATION — converts text to URL/filesystem-safe strings
//   3. PATH BUILDING — creates human-readable filenames from document metadata
//   4. PATH HELPERS — resolve relative paths to absolute filesystem paths
//
// FILE NAMING STRATEGY:
// Instead of storing files as meaningless UUIDs (e.g., "a1b2c3d4.pdf"),
// we use a human-readable naming convention so files are identifiable even
// if the database is lost:
//
//   uploads/
//   ├── doe-john/
//   │   ├── insurance_2024-03-15_zurich-ag_health-policy_a1b2c3d4.pdf
//   │   └── contracts_2024-01-10_employer-inc_work-contract_b2c3d4e5.pdf
//   └── whiskers-family/
//       └── vaccines_2023-06-20_vet-clinic_annual-booster_c3d4e5f6.pdf
//
// UPLOAD FLOW:
// 1. Multer saves the file with a temporary UUID name (e.g., "uuid.pdf")
// 2. The route handler validates the metadata (person, category, etc.)
// 3. We build the descriptive filename from the metadata
// 4. We rename the file from the temp name to the final name
// 5. The relative path is stored in the database
//
// Why this two-step approach? Because Multer's filename callback runs BEFORE
// the form data is parsed, so we don't know the metadata yet when saving.
// =============================================================================

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Where uploads are stored on disk. In Docker, this is /app/uploads (bind-mounted to NAS).
const uploadDir = process.env.UPLOAD_DIR || './uploads';
// Maximum file size in bytes. 25 MB = 26,214,400 bytes.
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '26214400');

// =============================================================================
// SLUGIFY — Convert any text into a filesystem/URL-safe string
// =============================================================================
//
// "Dr. Müller's Praxis" → "dr-mullers-praxis"
//
// Steps:
//   1. normalize('NFD') — split characters like "ü" into "u" + combining diacritic
//   2. Remove the diacritics (the combining marks in Unicode range 0300-036f)
//   3. Lowercase everything
//   4. Replace non-alphanumeric characters with hyphens
//   5. Collapse multiple hyphens into one
//   6. Trim hyphens from start/end
//   7. Truncate to maxLen characters
//
// This is essential because filenames can't contain special characters like
// spaces, slashes, colons, umlauts, etc. on all operating systems.
// =============================================================================

export function slugify(text, maxLen = 50) {
  if (!text) return '';
  return text
    .normalize('NFD')                  // "ü" → "u" + combining diaeresis
    .replace(/[\u0300-\u036f]/g, '')   // remove combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // anything not a-z or 0-9 becomes a hyphen
    .replace(/-+/g, '-')               // "a---b" → "a-b"
    .replace(/^-|-$/g, '')             // remove leading/trailing hyphens
    .slice(0, maxLen)                  // truncate long titles
    .replace(/-$/, '');                // clean up if truncation left a trailing hyphen
}

// =============================================================================
// BUILD DOCUMENT PATH — Create the human-readable file path
// =============================================================================
//
// Takes document metadata and builds:
//   relativePath: "doe-john/insurance_2024-03-15_zurich-ag_health-policy_a1b2c3d4.pdf"
//   absolutePath: "/app/uploads/doe-john/insurance_2024-03-15_zurich-ag_health-policy_a1b2c3d4.pdf"
//   dirPath:      "/app/uploads/doe-john"
//
// The UUID's first 8 characters are appended to guarantee uniqueness —
// even if two documents have identical metadata, they'll have different filenames.
// =============================================================================

export function buildDocumentPath(person, categorySlug, documentDate, institutionSlug, title, uuid) {
  const personSlug = slugify(`${person.first_name}-${person.last_name}`);
  const dateStr = documentDate || 'undated';
  const instStr = institutionSlug ? slugify(institutionSlug) : 'no-institution';
  const titleStr = slugify(title);
  const uuid8 = uuid.slice(0, 8); // first 8 chars of UUID for uniqueness

  // Pattern: {category}_{date}_{institution}_{title}_{uuid8}.pdf
  const filename = `${categorySlug}_${dateStr}_${instStr}_${titleStr}_${uuid8}.pdf`;
  const dirPath = path.join(uploadDir, personSlug);
  const relativePath = path.join(personSlug, filename);
  const absolutePath = path.join(uploadDir, relativePath);

  return { relativePath, absolutePath, dirPath };
}

// Create a directory (and all parent directories) if it doesn't exist.
// recursive: true means it won't fail if the directory already exists.
export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

// Try to remove an empty directory after the last file is deleted.
// If the directory still has files, rmdirSync throws an error — we catch
// and ignore it because a non-empty directory should not be removed.
export function removeEmptyDir(dirPath) {
  try {
    fs.rmdirSync(dirPath);
  } catch {
    // directory not empty or doesn't exist — that's fine
  }
}

// =============================================================================
// MULTER CONFIGURATION — Handles HTTP file uploads
// =============================================================================
//
// Multer is Express middleware for handling multipart/form-data (file uploads).
// It parses the incoming file and saves it to disk.
//
// diskStorage: saves files directly to disk (vs. memoryStorage which holds in RAM).
//   destination: which folder to save to
//   filename: what to name the file
//
// We use a TEMPORARY UUID filename here because Multer's filename callback
// runs before req.body is fully parsed — we don't know the document's
// metadata (title, person, etc.) yet. The route handler renames the file
// to the descriptive name after validating the metadata.
//
// fileFilter: only allow PDF files. We check the MIME type, not the extension,
// because extensions can be faked but MIME types are set by the browser based
// on actual file content.
// =============================================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // save to uploads directory
  },
  filename: (req, file, cb) => {
    const uuid = uuidv4();          // generate a random UUID (e.g., "550e8400-e29b-...")
    req.fileUuid = uuid;             // attach UUID to the request so the route can use it
    cb(null, `${uuid}.pdf`);         // temporary filename — will be renamed later
  }
});

// Only accept PDF files — reject everything else with an error.
function fileFilter(req, file, cb) {
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF files are allowed'), false);
  }
  cb(null, true);
}

// The configured Multer instance. Used in routes as: upload.single('file')
// .single('file') means we expect one file in a form field named "file".
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxFileSize } // reject files larger than 25 MB
});

// =============================================================================
// GET FILE PATH — Convert a database-stored relative path to an absolute path
// =============================================================================
//
// The database stores paths like: "doe-john/insurance_2024-03-15_..._a1b2c3d4.pdf"
// This function prepends the upload directory to get the full filesystem path.
// Used when streaming files to the browser or deleting files from disk.
// =============================================================================

export function getFilePath(relativePath) {
  return path.join(uploadDir, relativePath);
}
