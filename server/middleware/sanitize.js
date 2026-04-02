// =============================================================================
// sanitize.js — Input Sanitization Middleware
// =============================================================================
//
// WHAT IS XSS (Cross-Site Scripting)?
// If an attacker submits a form with:
//   title: "<script>alert('hacked')</script>"
// ...and we store that in the database and later display it on a page,
// the browser would execute the script. This is called "stored XSS".
//
// HOW WE PREVENT IT:
// This middleware runs on EVERY request and strips HTML tags from ALL
// string fields in the request body. So the attacker's input becomes
// just "alert('hacked')" — harmless plain text.
//
// DEFENSE IN DEPTH:
// This is one layer of protection. We also have:
//   - React's JSX automatically escapes output (prevents rendering HTML)
//   - CSP headers restrict which scripts can run
//   - Parameterized SQL queries prevent SQL injection
// Multiple layers means if one fails, others still protect us.
//
// NOTE: We only strip tags from strings. Numbers, booleans, and nested
// objects are handled recursively.
// =============================================================================

/**
 * Remove all HTML tags from a string.
 * Example: "<b>hello</b><script>bad</script>" → "hellobad"
 * The regex /<[^>]*>/g matches anything between < and >.
 */
function stripTags(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Recursively walk through an object and strip HTML tags from all string values.
 * This handles nested objects (like JSON bodies with sub-objects).
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = stripTags(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]); // recurse into nested objects
    }
  }
  return obj;
}

/**
 * Express middleware that sanitizes all string fields in req.body.
 * Applied globally in app.js before any routes run.
 */
export default function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  next(); // always continue — sanitization doesn't block requests
}
