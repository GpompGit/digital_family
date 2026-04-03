// =============================================================================
// rateLimit.js — Rate Limiting Middleware
// =============================================================================
//
// WHY RATE LIMITING?
// Without limits, an attacker could:
//   - Brute-force passwords by trying thousands of combinations per second
//   - Overload the server with requests (denial of service)
//   - Upload huge amounts of data to fill the disk
//
// HOW IT WORKS:
// express-rate-limit tracks how many requests each IP address makes within a
// time window. If they exceed the limit, further requests get a 429 response
// ("Too Many Requests") until the window resets.
//
// KEY CONCEPTS:
//   windowMs — the time window (in milliseconds)
//   max — maximum requests allowed in that window
//   keyGenerator — how to identify the client (usually by IP address)
//   standardHeaders — adds RateLimit-* headers so clients know their limits
//
// WHY x-forwarded-for?
// Our app runs behind Cloudflare Tunnel, so req.ip would be the tunnel's IP,
// not the real user's IP. The x-forwarded-for header contains the actual client
// IP, set by Cloudflare. We take the first IP in the list (before any commas).
// =============================================================================

import rateLimit from 'express-rate-limit';

// Login: strict limit — 5 attempts per 15 minutes per IP.
// This is the most important limiter because login is the attack surface
// for brute-force password guessing.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,     // sends RateLimit-Limit, RateLimit-Remaining headers
  legacyHeaders: false,      // don't send old X-RateLimit-* headers
  keyGenerator: (req) => {
    // Use the real client IP from Cloudflare, not the proxy IP
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  }
});

// Upload: 10 file uploads per minute per IP.
// Prevents filling the disk quickly, but still allows normal batch scanning.
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many uploads, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin API: 60 requests per minute per IP.
// Admin endpoints modify critical data (users, categories, etc.),
// so we limit them more strictly than general API calls.
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { error: 'Too many admin requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Forgot password: 3 requests per hour per IP.
// Stricter than login because password reset emails are expensive and
// can be used for email enumeration (though we return the same response regardless).
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Too many password reset requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  }
});

// General API: 120 requests per minute per IP.
// Covers all /api/* routes. Generous enough for normal browsing
// (loading documents, filters, etc.) but stops automated scraping.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});
