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
import deployRoutes from './routes/deploy.js';
import adminUserRoutes from './routes/admin/users.js';
import adminMetadataRoutes from './routes/admin/metadata.js';
import adminAuditRoutes from './routes/admin/audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;

// Session store
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  clearExpired: true,
  checkExpirationInterval: 900000,
  createDatabaseTable: false,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, pool);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind injects inline styles
      imgSrc: ["'self'", "data:", "blob:"],      // PDF.js renders to canvas/blob
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'self'", "blob:"],             // PDF viewer uses blob: URLs in iframes
      workerSrc: ["'self'", "blob:"],            // PDF.js web worker
      mediaSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],                // prevent clickjacking
    }
  },
  crossOriginEmbedderPolicy: false, // PDF.js worker needs cross-origin isolation disabled
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://digitalfamily.carbonnull.ch'
    : true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Input sanitization — strip HTML tags from all request bodies
import sanitizeInput from './middleware/sanitize.js';
app.use(sanitizeInput);

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Rate limiting
import { adminLimiter, apiLimiter } from './middleware/rateLimit.js';
app.use('/api/admin', adminLimiter);
app.use('/api', apiLimiter);

// API routes
app.use('/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin', adminMetadataRoutes);
app.use('/api/admin/audit', adminAuditRoutes);
app.use('/deploy', deployRoutes);

// Serve React frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/auth') && !req.path.startsWith('/deploy')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Digital Family running on port ${PORT}`);
});

export default app;
