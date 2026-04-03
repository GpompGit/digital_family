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
// NOTE: pdf-parse v2 requires Node 20+ (bundled pdfjs-dist). On Node 18 (DS713+),
// the import will fail. We catch this gracefully and return null — PDF text
// extraction is optional and only used for email ingestion auto-classification.
// =============================================================================

import fs from 'fs';

let pdfParse = null;

/**
 * Extract text content from a PDF file.
 *
 * @param {string} filePath — absolute path to the PDF file
 * @returns {Promise<string|null>} — extracted text, or null if no text found / error
 */
export async function extractTextFromPdf(filePath) {
  try {
    // Lazy-load pdf-parse to avoid crashing the app on Node 18
    if (pdfParse === null) {
      try {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        pdfParse = require('pdf-parse');
      } catch {
        console.warn('pdf-parse not available (requires Node 20+). PDF text extraction disabled.');
        pdfParse = false;
        return null;
      }
    }

    if (pdfParse === false) return null;

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
