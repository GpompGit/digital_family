// =============================================================================
// app.js — The main Express application entry point
// =============================================================================
//
// This file sets up the Express web server and wires everything together.
// Think of it as the "table of contents" for the backend:
//   1. Import all dependencies and route files
//   2. Configure middleware (functions that run BEFORE your route handlers)
//   3. Register routes (URL paths → handler functions)
//   4. Start listening for HTTP requests
//
// MIDDLEWARE ORDER MATTERS! Express processes middleware top-to-bottom.
// For example, helmet (security headers) must run before routes, and the
// error handler must be the LAST middleware registered.
// =============================================================================

import express from 'express';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db/connection.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import categoryRoutes from './routes/categories.js';
import userRoutes from './routes/users.js';
import institutionRoutes from './routes/institutions.js';
import tagRoutes from './routes/tags.js';
import assetRoutes from './routes/assets.js';
import deployRoutes from './routes/deploy.js';
import adminUserRoutes from './routes/admin/users.js';
import adminAssetRoutes from './routes/admin/assets.js';
import adminMetadataRoutes from './routes/admin/metadata.js';
import adminAuditRoutes from './routes/admin/audit.js';

// ES Modules don't have __dirname like CommonJS, so we derive it manually.
// __dirname = the folder where THIS file lives (server/).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;

// -----------------------------------------------------------------------------
// Session Store — saves user sessions in MariaDB instead of server memory.
// Why? If the server restarts, users stay logged in. Without this, every
// restart would log everyone out because sessions lived only in RAM.
// -----------------------------------------------------------------------------
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  clearExpired: true,                // automatically delete expired sessions
  checkExpirationInterval: 900000,   // check every 15 minutes (in milliseconds)
  createDatabaseTable: false,        // we create the table ourselves in schema.sql
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, pool); // pass our existing database connection pool

// =============================================================================
// MIDDLEWARE — functions that process EVERY request before it reaches a route.
// They run in the order they are registered with app.use().
// =============================================================================

// Helmet — sets various HTTP security headers automatically.
// Content Security Policy (CSP) tells the browser which resources are allowed.
// This prevents attackers from injecting malicious scripts (XSS attacks).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],                    // only load resources from our own domain
      scriptSrc: ["'self'"],                     // only run our own JavaScript
      styleSrc: ["'self'", "'unsafe-inline'"],   // Tailwind CSS injects inline styles, so we must allow it
      imgSrc: ["'self'", "data:", "blob:"],      // PDF.js creates blob: URLs for canvas rendering
      fontSrc: ["'self'", "data:"],               // allow data: URIs for bundled fonts
      connectSrc: ["'self'"],                    // AJAX/fetch requests only to our domain
      objectSrc: ["'none'"],                     // block Flash, Java applets, etc.
      frameSrc: ["'self'", "blob:"],             // PDF viewer opens blob: URLs in iframes
      workerSrc: ["'self'", "blob:"],            // PDF.js runs a web worker for parsing
      mediaSrc: ["'none'"],                      // no audio/video needed
      baseUri: ["'self'"],                       // prevent <base> tag hijacking
      formAction: ["'self'"],                    // forms can only submit to our domain
      frameAncestors: ["'none'"],                // prevent clickjacking (no one can embed us in an iframe)
    }
  },
  crossOriginEmbedderPolicy: false, // PDF.js worker needs this disabled to function
}));

// CORS — Cross-Origin Resource Sharing.
// Controls which websites can make requests to our API.
// In production, only our own domain is allowed. In development, any origin works.
// credentials: true means cookies (session) are sent with cross-origin requests.
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://digitalfamily.carbonnull.ch'
    : true,
  credentials: true,
}));

// Body parsers — convert incoming request bodies into JavaScript objects.
// express.json() handles JSON payloads (most API calls).
// express.urlencoded() handles form submissions.
// limit: '1mb' prevents attackers from sending huge payloads to crash the server.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Input sanitization — strips HTML tags from ALL incoming request body fields.
// This prevents "stored XSS" attacks where an attacker puts <script> tags in
// form fields that later get displayed to other users.
import sanitizeInput from './middleware/sanitize.js';
app.use(sanitizeInput);

// Session middleware — manages user login sessions via cookies.
// When a user logs in, we store their userId in the session.
// On every subsequent request, Express reads the session cookie and loads
// the session data from MariaDB, making req.session.userId available.
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'change-me', // used to sign the session cookie (must be random in production!)
  resave: false,            // don't save session if nothing changed
  saveUninitialized: false, // don't create session until something is stored
  cookie: {
    secure: process.env.NODE_ENV === 'production', // only send cookie over HTTPS in production
    httpOnly: true,    // JavaScript cannot access the cookie (prevents XSS cookie theft)
    sameSite: 'lax',   // cookie sent with same-site requests + top-level navigations (CSRF protection)
    maxAge: 7 * 24 * 60 * 60 * 1000 // cookie expires after 7 days (in milliseconds)
  }
}));

// Session idle timeout — destroy session if no activity for 30 minutes.
// The cookie maxAge (7 days) controls how long the cookie lives in the browser.
// This middleware adds an ADDITIONAL check: if the user hasn't made any request
// in 30 minutes, we destroy the session even if the cookie is still valid.
// This protects against someone leaving a logged-in browser unattended.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
app.use((req, res, next) => {
  if (req.session && req.session.userId) {
    const now = Date.now();
    if (req.session.lastActivity && (now - req.session.lastActivity > IDLE_TIMEOUT_MS)) {
      // Session has been idle too long — destroy it
      return req.session.destroy(() => {
        res.status(401).json({ error: 'Session expired due to inactivity' });
      });
    }
    // Update last activity timestamp (touch the session)
    req.session.lastActivity = now;
  }
  next();
});

// Rate limiting — prevents abuse by limiting how many requests a client can make.
// Applied BEFORE routes so blocked requests never reach the handlers.
// Admin routes get a stricter limit (60/min) than general API routes (120/min).
import { adminLimiter, apiLimiter } from './middleware/rateLimit.js';
app.use('/api/admin', adminLimiter);  // must come before admin routes
app.use('/api', apiLimiter);          // must come before API routes

// =============================================================================
// ROUTES — URL paths mapped to handler functions.
// Each route file is an Express Router that handles a group of related endpoints.
// For example, '/api/documents' handles list, get, create, update, delete.
// =============================================================================
app.use('/auth', authRoutes);                  // login, logout, session status
app.use('/api/documents', documentRoutes);     // document CRUD + file upload/stream
app.use('/api/categories', categoryRoutes);    // list categories (for dropdowns)
app.use('/api/users', userRoutes);             // current user profile + list all users
app.use('/api/institutions', institutionRoutes); // list institutions (for dropdowns)
app.use('/api/tags', tagRoutes);               // list tags (for filter dropdowns)
app.use('/api/assets', assetRoutes);           // list assets (for filter dropdowns)
app.use('/api/admin/users', adminUserRoutes);  // admin: manage users, reset passwords
app.use('/api/admin/assets', adminAssetRoutes); // admin: manage assets + user attributes
app.use('/api/admin', adminMetadataRoutes);    // admin: manage categories, institutions, tags, custom fields
app.use('/api/admin/audit', adminAuditRoutes); // admin: view audit log
app.use('/deploy', deployRoutes);              // GitHub webhook for auto-deploy

// =============================================================================
// STATIC FILES & SPA (Single Page Application) CATCH-ALL
// =============================================================================
//
// 1. express.static serves the built React app (HTML, JS, CSS) from /public.
// 2. The catch-all route handles client-side routing: when someone visits
//    /documents/abc123, the server doesn't have that route — it's a React
//    Router route. So we serve index.html and let React handle the URL.
//    We exclude /api, /auth, and /deploy paths so those still hit the backend.
// =============================================================================
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/auth') && !req.path.startsWith('/deploy')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// =============================================================================
// GLOBAL ERROR HANDLER — catches any unhandled errors from route handlers.
// Must be registered LAST (after all routes) and must have 4 parameters
// (err, req, res, next) so Express recognizes it as an error handler.
// Never expose internal error details to the client (security risk).
// =============================================================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server and listen for incoming HTTP requests on the configured port.
// After the server is running, start the email ingestion job (if enabled).
// This polls an IMAP mailbox for forwarded emails with PDF attachments.
import { startEmailIngestion } from './jobs/emailIngestion.js';
app.listen(PORT, () => {
  console.log(`Digital Family running on port ${PORT}`);

  // Start email ingestion if configured
  if (process.env.IMAP_ENABLED === 'true') {
    startEmailIngestion();
  }
});

export default app;
