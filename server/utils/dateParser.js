// =============================================================================
// dateParser.js — German/European Date Extraction & Normalization
// =============================================================================
//
// Invoices arrive in many formats — paper scans, German emails, Swiss PDFs.
// This module extracts dates from free text and normalizes them to ISO format
// (YYYY-MM-DD) for uniform database storage.
//
// Supported input formats:
//   "Bezahlt 15.03.2024"        → 2024-03-15
//   "Bezahlt am 15.03.2024"     → 2024-03-15
//   "Bezahlt 24.03.15"          → 2024-03-15 (2-digit year)
//   "15/03/2024"                → 2024-03-15
//   "2024-03-15"                → 2024-03-15 (ISO passthrough)
//   "15. März 2024"             → 2024-03-15
//   "15. Mär 2024"              → 2024-03-15
//   "15. Mär. 2024"             → 2024-03-15
//   "March 15, 2024"            → 2024-03-15
//   "Paid on 15.03.2024"        → 2024-03-15
//
// Also extracts amounts (CHF 127.50, EUR 99,00, Betrag: 42,50) and
// invoice numbers (Rechnungsnummer: INV-001, Invoice #12345).
// =============================================================================

// German month names → month number (1-indexed)
const MONTH_MAP = {
  // Full names (German)
  'januar': 1, 'februar': 2, 'märz': 3, 'april': 4, 'mai': 5, 'juni': 6,
  'juli': 7, 'august': 8, 'september': 9, 'oktober': 10, 'november': 11, 'dezember': 12,
  // Abbreviated (German) — with and without trailing dot
  'jan': 1, 'feb': 2, 'mär': 3, 'mrz': 3, 'apr': 4, 'jun': 6,
  'jul': 7, 'aug': 8, 'sep': 9, 'okt': 10, 'nov': 11, 'dez': 12,
  // Full names (English)
  'january': 1, 'february': 2, 'march': 3, 'may': 5, 'june': 6,
  'july': 7, 'august': 8, 'october': 10, 'december': 12,
  // Full names (Spanish)
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
};

/**
 * Resolve a 2-digit year to 4 digits.
 * 00–49 → 2000–2049, 50–99 → 1950–1999
 */
function resolveYear(y) {
  if (y < 100) return y < 50 ? 2000 + y : 1900 + y;
  return y;
}

/**
 * Validate and format a date as YYYY-MM-DD.
 * Returns null if the date components are invalid.
 */
function toISO(year, month, day) {
  const y = resolveYear(year);
  if (month < 1 || month > 12 || day < 1 || day > 31 || y < 1900 || y > 2100) return null;
  // Quick sanity check via Date constructor
  const d = new Date(y, month - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${String(y).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parse a single date string into YYYY-MM-DD format.
 * Strips common prefixes like "Bezahlt", "Bezahlt am", "Paid on", etc.
 *
 * @param {string} text — the date string to parse
 * @returns {string|null} — ISO date string or null if unparseable
 */
export function parseDateString(text) {
  if (!text || typeof text !== 'string') return null;

  // Strip common prefixes (German + English)
  let cleaned = text.trim()
    .replace(/^(bezahlt\s+am|bezahlt|paid\s+on|paid|datum|date|am|on|vom|du|le)\s*/i, '')
    .replace(/[.,;:]\s*$/, '') // trailing punctuation
    .trim();

  // 1. ISO format: YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return toISO(parseInt(isoMatch[1]), parseInt(isoMatch[2]), parseInt(isoMatch[3]));

  // 2. Named month: "15. März 2024" or "15 März 2024" or "15. Mär. 2024"
  const namedMatch = cleaned.match(/^(\d{1,2})\.?\s+(\w+)\.?\s+(\d{2,4})$/i);
  if (namedMatch) {
    const monthNum = MONTH_MAP[namedMatch[2].toLowerCase()];
    if (monthNum) return toISO(parseInt(namedMatch[3]), monthNum, parseInt(namedMatch[1]));
  }

  // 3. English named month: "March 15, 2024"
  const enNamedMatch = cleaned.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (enNamedMatch) {
    const monthNum = MONTH_MAP[enNamedMatch[1].toLowerCase()];
    if (monthNum) return toISO(parseInt(enNamedMatch[3]), monthNum, parseInt(enNamedMatch[2]));
  }

  // 4. Dot format: DD.MM.YYYY or DD.MM.YY
  const dotMatch = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotMatch) return toISO(parseInt(dotMatch[3]), parseInt(dotMatch[2]), parseInt(dotMatch[1]));

  // 5. Slash format: DD/MM/YYYY or DD/MM/YY
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) return toISO(parseInt(slashMatch[3]), parseInt(slashMatch[2]), parseInt(slashMatch[1]));

  // 6. Dash format without ISO: DD-MM-YYYY
  const dashMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) return toISO(parseInt(dashMatch[3]), parseInt(dashMatch[2]), parseInt(dashMatch[1]));

  return null;
}

/**
 * Extract paid date, invoice date, and due date from free text.
 * Searches for keyword + date patterns in the text.
 *
 * @param {string} text — email body or PDF extracted text
 * @returns {{ paidDate: string|null, invoiceDate: string|null, dueDate: string|null }}
 */
export function extractDatesFromText(text) {
  if (!text) return { paidDate: null, invoiceDate: null, dueDate: null };

  const result = { paidDate: null, invoiceDate: null, dueDate: null };

  // Paid date patterns (German + English)
  const paidPatterns = [
    /(?:bezahlt\s*(?:am)?|paid\s*(?:on)?|zahlungsdatum|payment\s*date)\s*[:.]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i,
    /(?:bezahlt\s*(?:am)?|paid\s*(?:on)?)\s*[:.]?\s*(\d{1,2}\.?\s+\w+\.?\s+\d{2,4})/i,
  ];
  for (const pattern of paidPatterns) {
    const match = text.match(pattern);
    if (match) { result.paidDate = parseDateString(match[1]); if (result.paidDate) break; }
  }

  // Invoice date patterns
  const invoiceDatePatterns = [
    /(?:rechnungsdatum|invoice\s*date|factura\s*fecha|datum\s*der\s*rechnung)\s*[:.]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i,
    /(?:rechnungsdatum|invoice\s*date)\s*[:.]?\s*(\d{1,2}\.?\s+\w+\.?\s+\d{2,4})/i,
  ];
  for (const pattern of invoiceDatePatterns) {
    const match = text.match(pattern);
    if (match) { result.invoiceDate = parseDateString(match[1]); if (result.invoiceDate) break; }
  }

  // Due date patterns
  const dueDatePatterns = [
    /(?:fällig\s*(?:am)?|fälligkeitsdatum|zahlbar\s*bis|due\s*(?:date|by)?|payable\s*by)\s*[:.]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i,
    /(?:fällig\s*(?:am)?|due\s*(?:date|by)?)\s*[:.]?\s*(\d{1,2}\.?\s+\w+\.?\s+\d{2,4})/i,
  ];
  for (const pattern of dueDatePatterns) {
    const match = text.match(pattern);
    if (match) { result.dueDate = parseDateString(match[1]); if (result.dueDate) break; }
  }

  return result;
}

/**
 * Extract a monetary amount and currency from text.
 * Handles Swiss/German formats: "CHF 1'234.50", "EUR 99,00", "Betrag: 42,50"
 *
 * @param {string} text — email body or PDF extracted text
 * @returns {{ amount: number, currency: string }|null}
 */
export function extractAmountFromText(text) {
  if (!text) return null;

  // Pattern: currency + amount (CHF 1'234.50, EUR 99,00, USD 10.00)
  const currencyFirstPatterns = [
    /(?:CHF|EUR|USD)\s*([0-9]{1,3}(?:[''.]?[0-9]{3})*[.,]\d{2})/i,
    /(?:CHF|EUR|USD)\s*([0-9]+(?:[.,]\d{2})?)/i,
  ];

  // Pattern: amount + currency (1'234.50 CHF, 99,00 EUR)
  const currencyLastPatterns = [
    /([0-9]{1,3}(?:[''.]?[0-9]{3})*[.,]\d{2})\s*(?:CHF|EUR|USD)/i,
  ];

  // Pattern: labeled amount (Betrag: 42,50 / Total: 99.00 / Rechnungsbetrag: 127,50)
  const labeledPatterns = [
    /(?:betrag|total|rechnungsbetrag|gesamtbetrag|amount|summe|nettobetrag)\s*[:.]?\s*(?:CHF|EUR|USD)?\s*([0-9]{1,3}(?:[''.]?[0-9]{3})*[.,]\d{2})/i,
  ];

  function parseAmount(str) {
    // Remove thousand separators (apostrophe, dot before 3 digits, space)
    let cleaned = str.replace(/['']/g, '').replace(/\s/g, '');
    // If the format uses comma as decimal separator (European), convert
    if (cleaned.includes(',') && !cleaned.includes('.')) {
      cleaned = cleaned.replace(',', '.');
    } else if (cleaned.includes(',') && cleaned.includes('.')) {
      // 1.234,50 → 1234.50 (dot is thousands, comma is decimal)
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  function detectCurrency(context) {
    const upper = context.toUpperCase();
    if (upper.includes('EUR') || upper.includes('€')) return 'EUR';
    if (upper.includes('USD') || upper.includes('$')) return 'USD';
    return 'CHF'; // default for Swiss family
  }

  const allPatterns = [...currencyFirstPatterns, ...currencyLastPatterns, ...labeledPatterns];
  for (const pattern of allPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount !== null && amount > 0) {
        return { amount, currency: detectCurrency(match[0]) };
      }
    }
  }

  return null;
}

/**
 * Extract invoice number from text.
 * Handles: "Rechnungsnummer: INV-001", "Rechnung Nr. 12345", "Invoice #12345"
 *
 * @param {string} text — email body or PDF extracted text
 * @returns {string|null}
 */
export function extractInvoiceNumber(text) {
  if (!text) return null;

  const patterns = [
    /(?:rechnungsnummer|rechnung\s*nr\.?|invoice\s*(?:number|no\.?|#)|factura\s*(?:no\.?|número))\s*[:.]?\s*([A-Za-z0-9\-/_.]{3,30})/i,
    /(?:Beleg-?Nr\.?|Belegnummer|Reference|Ref\.?\s*(?:No\.?|#)?)\s*[:.]?\s*([A-Za-z0-9\-/_.]{3,30})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}
