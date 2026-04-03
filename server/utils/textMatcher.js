// =============================================================================
// textMatcher.js — Matching Rules Engine for Auto-Classification
// =============================================================================
//
// HOW AUTO-CLASSIFICATION WORKS:
// When a document is ingested (via email or future OCR), we have its text content.
// The matching_rules table contains patterns that map text → entities:
//
//   rule: entity_type='category', entity_id=6 (Insurance), pattern='insurance policy zurich'
//   algorithm: 'any_word'
//   → If the document text contains "insurance" OR "policy" OR "zurich",
//     this rule matches and the document gets category_id = 6.
//
// MATCHING ALGORITHMS:
//   exact      — pattern must appear as-is in the text (case-insensitive substring)
//   any_word   — split pattern by spaces; if ANY word appears, it matches
//   all_words  — split pattern by spaces; ALL words must appear
//   regex      — pattern is a regular expression
//   fuzzy      — basic token overlap: if >50% of pattern words appear, it matches
//
// PRIORITY:
//   - Category: first matching rule wins (a document has exactly one category)
//   - Institution: first matching rule wins (a document has at most one institution)
//   - Tags: ALL matching rules that match are applied (many-to-many)
//   - If no category matches → returns "uncategorized" as fallback
// =============================================================================

import pool from '../db/connection.js';

/**
 * Apply all active matching rules against a text and return matched entities.
 *
 * @param {string} text — the document text to match against (extracted_text + title)
 * @returns {Promise<{ categoryId: number|null, institutionId: number|null, tagIds: number[] }>}
 */
export async function applyMatchingRules(text) {
  if (!text) {
    return { categoryId: null, institutionId: null, tagIds: [] };
  }

  // Load all active rules, ordered by entity_type so we process them predictably
  const [rules] = await pool.query(
    'SELECT id, entity_type, entity_id, match_pattern, matching_algorithm FROM matching_rules WHERE is_active = TRUE ORDER BY entity_type, id'
  );

  let categoryId = null;
  let institutionId = null;
  const tagIds = [];

  const lowerText = text.toLowerCase();

  for (const rule of rules) {
    const matched = testRule(lowerText, rule.match_pattern, rule.matching_algorithm);

    if (!matched) continue;

    switch (rule.entity_type) {
      case 'category':
        // First matching category wins
        if (categoryId === null) {
          categoryId = rule.entity_id;
        }
        break;
      case 'institution':
        // First matching institution wins
        if (institutionId === null) {
          institutionId = rule.entity_id;
        }
        break;
      case 'tag':
        // All matching tags are collected
        if (!tagIds.includes(rule.entity_id)) {
          tagIds.push(rule.entity_id);
        }
        break;
    }
  }

  return { categoryId, institutionId, tagIds };
}

/**
 * Test a single matching rule against text.
 *
 * @param {string} lowerText — the document text, already lowercased
 * @param {string} pattern — the match pattern from the rule
 * @param {string} algorithm — 'exact' | 'any_word' | 'all_words' | 'regex' | 'fuzzy'
 * @returns {boolean} — true if the rule matches
 */
function testRule(lowerText, pattern, algorithm) {
  if (!pattern) return false;
  const lowerPattern = pattern.toLowerCase();

  switch (algorithm) {
    case 'exact':
      // The entire pattern must appear as a substring in the text
      return lowerText.includes(lowerPattern);

    case 'any_word': {
      // Split pattern into words; if ANY word is found, it matches
      const words = lowerPattern.split(/\s+/).filter(w => w.length > 0);
      return words.some(word => lowerText.includes(word));
    }

    case 'all_words': {
      // Split pattern into words; ALL words must be found
      const words = lowerPattern.split(/\s+/).filter(w => w.length > 0);
      return words.every(word => lowerText.includes(word));
    }

    case 'regex':
      // Pattern is a regular expression — test it against the text
      // Wrapped in try/catch because user-defined regex could be invalid
      try {
        const regex = new RegExp(pattern, 'i'); // case-insensitive
        return regex.test(lowerText);
      } catch {
        console.error(`Invalid regex in matching rule: "${pattern}"`);
        return false;
      }

    case 'fuzzy': {
      // Basic fuzzy matching: if more than 50% of pattern words appear, it matches.
      // This is a simple token-overlap approach, not Levenshtein distance.
      // Good enough for matching "zurich insurance AG" against text containing
      // "Zurich" and "insurance" but not "AG".
      const words = lowerPattern.split(/\s+/).filter(w => w.length > 1); // skip single chars
      if (words.length === 0) return false;
      const matchCount = words.filter(word => lowerText.includes(word)).length;
      return matchCount / words.length > 0.5;
    }

    default:
      return false;
  }
}
