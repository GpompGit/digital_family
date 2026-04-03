// =============================================================================
// pdfTextExtract.js — Extract text from PDF files
// =============================================================================
//
// Uses pdf-parse to extract the TEXT LAYER from PDFs. This works for:
//   - PDFs created digitally (Word → PDF, browser print, etc.) — text is embedded
//   - PDFs with an OCR layer (iPhone scanner adds a text layer automatically)
//
// This does NOT work for:
//   - Image-only scanned PDFs (no text layer) — returns null
//   - For those, a full OCR engine (Tesseract.js) would be needed (future feature)
//
// pdf-parse uses Mozilla's PDF.js under the hood — same library that powers
// the browser's built-in PDF viewer and our react-pdf thumbnails.
// =============================================================================

import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Extract text content from a PDF file.
 *
 * @param {string} filePath — absolute path to the PDF file
 * @returns {Promise<string|null>} — extracted text, or null if no text found / error
 */
export async function extractTextFromPdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const result = await pdfParse(dataBuffer);

    // result.text contains all extracted text, joined across pages
    const text = result.text?.trim();

    // If the PDF has no text layer (image-only scan), text will be empty
    if (!text || text.length < 10) {
      return null;
    }

    return text;
  } catch (err) {
    // pdf-parse can fail on corrupted, password-protected, or malformed PDFs
    console.error('PDF text extraction failed:', err.message);
    return null;
  }
}
