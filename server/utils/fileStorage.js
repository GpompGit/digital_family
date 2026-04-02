import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '26214400'); // 25 MB

/**
 * Slugify a string: lowercase, strip diacritics, replace non-alphanumeric with hyphens.
 * @param {string} text
 * @param {number} maxLen - maximum length (default 50)
 * @returns {string}
 */
export function slugify(text, maxLen = 50) {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumeric → hyphen
    .replace(/-+/g, '-')               // collapse multiple hyphens
    .replace(/^-|-$/g, '')             // trim leading/trailing hyphens
    .slice(0, maxLen)
    .replace(/-$/, '');                // trim trailing hyphen after truncation
}

/**
 * Build a human-readable file path for a document.
 * Pattern: {person-slug}/{category}_{date}_{institution}_{title}_{uuid8}.pdf
 *
 * @param {{ first_name: string, last_name: string }} person
 * @param {string} categorySlug
 * @param {string|null} documentDate - YYYY-MM-DD or null
 * @param {string|null} institutionSlug - slug or null
 * @param {string} title
 * @param {string} uuid
 * @returns {{ relativePath: string, absolutePath: string, dirPath: string }}
 */
export function buildDocumentPath(person, categorySlug, documentDate, institutionSlug, title, uuid) {
  const personSlug = slugify(`${person.first_name}-${person.last_name}`);
  const dateStr = documentDate || 'undated';
  const instStr = institutionSlug ? slugify(institutionSlug) : 'no-institution';
  const titleStr = slugify(title);
  const uuid8 = uuid.slice(0, 8);

  const filename = `${categorySlug}_${dateStr}_${instStr}_${titleStr}_${uuid8}.pdf`;
  const dirPath = path.join(uploadDir, personSlug);
  const relativePath = path.join(personSlug, filename);
  const absolutePath = path.join(uploadDir, relativePath);

  return { relativePath, absolutePath, dirPath };
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 */
export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Try to remove an empty directory. Fails silently if not empty or doesn't exist.
 */
export function removeEmptyDir(dirPath) {
  try {
    fs.rmdirSync(dirPath);
  } catch {
    // directory not empty or doesn't exist — ignore
  }
}

// Multer uploads to a temp UUID filename; routes rename after metadata validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uuid = uuidv4();
    req.fileUuid = uuid;
    cb(null, `${uuid}.pdf`);
  }
});

function fileFilter(req, file, cb) {
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF files are allowed'), false);
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxFileSize }
});

/**
 * Get absolute file path from a relative path stored in the database.
 * @param {string} relativePath - e.g. "doe-john/insurance_2024-03-15_zurich-ag_health-policy_a1b2c3d4.pdf"
 * @returns {string} absolute path
 */
export function getFilePath(relativePath) {
  return path.join(uploadDir, relativePath);
}
