# Digital Family — Sprint Plan

> **Branch:** `claude/plan-database-schema-pe7Y7`
> **Last updated:** 2026-04-03
> **Status:** Sprint 1, tasks 1.1–1.4/1.6/1.7 complete. Next: task 1.5 (password reset via email)

---

## What's Done (Sprint 0 — Foundation)

| # | Commit | What |
|---|--------|------|
| 1 | `4634271` | Initial project scaffold — Express, React, Docker, CI/CD |
| 2 | `dbb06ca` | Database schema redesign — 12 tables: users (role, can_login, password_hash), categories, institutions, tags, document_tags, documents (person_id FK, institution_id FK, extracted_text, expires_at, version, parent_uuid), custom_field_definitions, document_custom_fields, matching_rules, audit_log, sessions |
| 3 | `81b86f2` | Human-readable file naming — `{person}/{category}_{date}_{institution}_{title}_{uuid8}.pdf` with person subdirectories |
| 4 | `4f8c944` | i18n — react-i18next with EN/DE/ES, browser language auto-detection, language switcher |
| 5 | `028cd22` | Admin settings — requireAdmin middleware, CRUD for users/categories/institutions/tags/custom-fields, audit log viewer, bcrypt password auth |
| 6 | `f67f344` | Enhanced browsing — PDF thumbnail (react-pdf), tag/institution/date-range filters, print/share/download actions, owner-only delete |
| 7 | `8a30f71` | Sprint plan document |
| 8 | `fe418da` | Security hardening — honeypot, lockout, CSP, audit, sanitization |
| 9 | `74f0126` | Sprint plan: add code comments task |
| 10 | `1e3eb61` | Beginner-friendly comments: all backend files |
| 11 | `6bbd344` | Beginner-friendly comments: frontend + infrastructure files |
| 12 | `a1adc08` | Security: password complexity, idle timeout, CRUD audit, path traversal |
| 13 | `ad039a3` | Error boundaries + loading skeleton screens |
| 14 | (pending) | Email-to-document ingestion with IMAP, text extraction, auto-classification |

### Current File Inventory

**Backend:**
- `server/app.js` — Express app, all routes registered, CSP configured, rate limiters applied, input sanitization, email ingestion startup
- `server/db/schema.sql` — 12 tables, all indexes, FULLTEXT search
- `server/db/seed.sql` — categories (incl. Uncategorized), 4 humans + 2 cats, institutions, tags
- `server/jobs/emailIngestion.js` — IMAP polling, email parsing, PDF extraction, auto-classification, document storage
- `server/utils/pdfTextExtract.js` — PDF text layer extraction (pdf-parse)
- `server/utils/textMatcher.js` — Matching rules engine (exact, any_word, all_words, regex, fuzzy)
- `server/middleware/` — requireAuth, requireAdmin, rateLimit (login/upload/admin/api), sanitize (HTML strip)
- `server/routes/auth.js` — email+password login with honeypot, account lockout, audit logging, logout
- `server/routes/documents.js` — CRUD + file stream + owner-only delete + file rename on update
- `server/routes/categories.js`, `institutions.js`, `tags.js` — public listing endpoints
- `server/routes/users.js` — /me + list all
- `server/routes/deploy.js` — GitHub webhook
- `server/routes/admin/users.js` — CRUD + password reset
- `server/routes/admin/metadata.js` — CRUD for categories, institutions, tags, custom fields
- `server/routes/admin/audit.js` — paginated audit log with filters
- `server/utils/fileStorage.js` — slugify, buildDocumentPath, ensureDir, removeEmptyDir, multer
- `server/utils/email.js` — nodemailer (magic link — needs update for password reset)
- `server/utils/audit.js` — audit_log helper (logAudit)

**Frontend:**
- `frontend/src/i18n/` — config + 3 locale files (en, de, es)
- `frontend/src/context/AuthContext.tsx` — auth state
- `frontend/src/components/Layout.tsx` — nav + language switcher + admin link
- `frontend/src/pages/LoginPage.tsx` — email+password login with honeypot field + lockout message
- `frontend/src/pages/DashboardPage.tsx` — filters (search, category, person, institution, tag, date range, sort) + document list + pagination
- `frontend/src/pages/DocumentPage.tsx` — PDF preview + metadata + print/share/download/edit/delete (owner-only)
- `frontend/src/pages/UploadPage.tsx` — upload form (person_id, institution_id, expires_at)
- `frontend/src/pages/EditDocumentPage.tsx` — edit metadata + file rename
- `frontend/src/pages/admin/` — SettingsLayout, UsersPage, MetadataPage, AuditLogPage
- `frontend/src/services/api.ts` — all API calls
- `frontend/src/types/index.ts` — TypeScript interfaces

---

## Sprint 1 — Security & Core Quality

> **Goal:** Lock down the application, then make it feel polished.

### 1.1 Security Hardening ✅ DONE (commit `fe418da`)

**Already implemented:**
- [x] Honeypot on login form (hidden field, catches bots, logged to audit)
- [x] Account lockout after 5 failed attempts per email (15-min cooldown)
- [x] All login/logout events logged to audit_log with IP, reason, attempt count
- [x] Content Security Policy configured (self, blob: for PDF.js, frame-ancestors none)
- [x] CORS restricted to production domain in production
- [x] Rate limiting: login 5/15min, upload 10/min, admin 60/min, API 120/min (per IP via x-forwarded-for)
- [x] Input sanitization middleware (strips HTML tags from all req.body)
- [x] Audit infrastructure (`server/utils/audit.js` helper)
- [x] Owner-only delete (user_id check + admin override on DELETE route)
- [x] Parameterized SQL queries (all routes, verified)
- [x] bcrypt password hashing (cost factor 10)
- [x] Session cookies: httpOnly, secure (production), sameSite lax

**Remaining security tasks:**
- [ ] Password complexity enforcement — require minimum 8 chars + at least one number + one letter on all password endpoints (admin create, admin reset, future user self-change)
- [ ] Session idle timeout — destroy session after 30 min of inactivity (not just 7-day maxAge)
- [ ] Audit logging on document CRUD — call `logAudit()` from document create, update, delete, download routes
- [ ] Audit logging on admin operations — call `logAudit()` from admin user/metadata CRUD routes
- [ ] Clean up `server/utils/email.js` — remove magic link references, prepare for password reset
- [ ] File path traversal protection — validate that `file_path` from DB doesn't escape uploads dir (defense-in-depth)
- [ ] Deploy webhook signature timing-safe comparison — verify `crypto.timingSafeEqual` is used in deploy route
- [ ] Helmet `Referrer-Policy: strict-origin-when-cross-origin` (verify default)
- [ ] Helmet `X-Content-Type-Options: nosniff` (verify default)
- [ ] Helmet `Permissions-Policy` — disable camera, microphone, geolocation (not needed)

**Files:** `server/routes/documents.js`, `server/routes/admin/*.js`, `server/utils/email.js`, `server/routes/deploy.js`, `server/app.js`

### 1.2 Beginner-Friendly Code Comments ✅ DONE (commits `1e3eb61`, `6bbd344`)

> Add educational comments throughout the codebase explaining **what** the code does and **why**, aimed at someone learning Node.js/Express/React/SQL for the first time.

**Backend — Express & Node.js:**
- [ ] `server/app.js` — explain middleware chain (what runs in what order and why), session setup, static file serving, SPA catch-all
- [ ] `server/db/connection.js` — explain connection pooling (why not one connection per request)
- [ ] `server/db/schema.sql` — explain each table's purpose, FK relationships, index rationale, FULLTEXT search, ON DELETE behavior
- [ ] `server/middleware/requireAuth.js` — explain session-based auth, why middleware pattern exists
- [ ] `server/middleware/requireAdmin.js` — explain role-based access control
- [ ] `server/middleware/rateLimit.js` — explain why rate limiting matters, what each limit protects against
- [ ] `server/middleware/sanitize.js` — explain XSS, why we strip HTML tags
- [ ] `server/routes/auth.js` — explain password hashing (bcrypt), honeypot technique, account lockout pattern, why same error for all failures (timing attacks)
- [ ] `server/routes/documents.js` — explain parameterized queries (SQL injection), file upload flow (multer → temp → rename), ownership checks
- [ ] `server/routes/admin/*.js` — explain admin-only patterns, polymorphic FK in matching_rules
- [ ] `server/utils/fileStorage.js` — explain slugify (unicode normalization), multer disk storage, why UUID in filenames
- [ ] `server/utils/audit.js` — explain audit trail pattern, why fire-and-forget (no await needed in routes)
- [ ] `server/utils/email.js` — explain SMTP, nodemailer transporter pattern

**Frontend — React & TypeScript:**
- [ ] `frontend/src/main.tsx` — explain React entry point, StrictMode, PDF.js worker setup
- [ ] `frontend/src/App.tsx` — explain React Router, protected routes, layout nesting, admin guard
- [ ] `frontend/src/context/AuthContext.tsx` — explain React Context, why global auth state, the provider/consumer pattern
- [ ] `frontend/src/components/Layout.tsx` — explain Outlet (nested routing), conditional rendering based on role
- [ ] `frontend/src/pages/LoginPage.tsx` — explain react-hook-form, honeypot technique (frontend side), controlled vs uncontrolled inputs
- [ ] `frontend/src/pages/DashboardPage.tsx` — explain useEffect (data fetching), filter state management, pagination pattern
- [ ] `frontend/src/pages/DocumentPage.tsx` — explain react-pdf, Web Share API, useCallback for stable references
- [ ] `frontend/src/pages/UploadPage.tsx` — explain FormData, multipart upload, file input handling
- [ ] `frontend/src/pages/admin/MetadataPage.tsx` — explain generic/reusable component pattern (props-driven CRUD)
- [ ] `frontend/src/services/api.ts` — explain axios instance, baseURL, withCredentials (cookies), async/await
- [ ] `frontend/src/types/index.ts` — explain TypeScript interfaces, optional fields, union types
- [ ] `frontend/src/i18n/index.ts` — explain i18n setup, language detection, fallback chain

**Infrastructure:**
- [ ] `Dockerfile` — explain multi-stage builds, why separate frontend build from production image
- [ ] `docker-compose.yml` — explain service dependencies, volumes, healthchecks, env vars
- [ ] `.env.example` — explain each variable's purpose and security implications

**Files:** all files listed above (comments only — no logic changes)

### 1.3 Toast Notification System ✅ DONE

- [x] Install `react-hot-toast`
- [x] Create a `<Toaster />` in App.tsx (top-center, 3s duration)
- [x] Replace ALL `alert()` calls with toast (DocumentPage, admin pages, ProfilePage)
- [x] Add success toasts: upload, update, delete, password reset, CRUD operations
- [x] Add info toast for clipboard copy (share fallback)
- [x] Login errors kept inline (form context, not toast)
- [x] Translations for all toast messages (en/de/es) — 12 keys each

**Files:** `frontend/package.json`, `frontend/src/App.tsx`, DocumentPage, UploadPage, EditDocumentPage, ProfilePage, UsersPage, MetadataPage, AssetsPage, locale files

### 1.4 User Account / Profile Page ✅ DONE

- [x] Backend: `PUT /api/users/me` — update own first_name, last_name, birth_date
- [x] Backend: `PUT /api/users/me/password` — change own password (requires current password + complexity validation)
- [x] Backend: CRUD for addresses, contacts, identity documents, key-value attributes
- [x] Backend: `GET /api/users/:id/profile` — view family member profiles (read-only)
- [x] Frontend: `ProfilePage.tsx` — full profile with 6 sections: basic info, password, addresses, contacts, identity docs, attributes
- [x] Dual mode: own profile (editable) vs family member (read-only via `/family/:id`)
- [x] Route: `/profile` (own) + `/family/:id` (view others)
- [x] "Profile" link in nav
- [x] Translations (en/de/es) — 50+ keys each

**Files:** `server/routes/users.js`, `server/db/schema.sql` (3 new tables), new `frontend/src/pages/ProfilePage.tsx`, `App.tsx`, `Layout.tsx`, locale files

### 1.5 Password Reset via Email
- [ ] Backend: `POST /auth/forgot-password` — generate reset token, send email
- [ ] Backend: `POST /auth/reset-password` — verify token, set new password (with complexity rules)
- [ ] Schema: add `password_reset_tokens` table (id, user_id, token CHAR(64) UNIQUE, used BOOLEAN, expires_at DATETIME, created_at DATETIME)
- [ ] Frontend: "Forgot password?" link on login page
- [ ] Frontend: `ResetPasswordPage.tsx` — enter new password after clicking email link
- [ ] Rewrite `server/utils/email.js` — remove magic link, add password reset email template
- [ ] Rate limit on forgot-password (3 per hour per email)
- [ ] Translations (en/de/es)

**Files:** `server/db/schema.sql`, `server/routes/auth.js`, `server/utils/email.js`, new frontend pages, locale files

### 1.6 Error Boundaries ✅ DONE (commit `ad039a3`)
- [ ] Create `ErrorBoundary.tsx` component (catches React render errors)
- [ ] Wrap the app (or route sections) with error boundary
- [ ] Show a friendly "Something went wrong" page with a "Go home" button
- [ ] Translations (en/de/es)

**Files:** new `frontend/src/components/ErrorBoundary.tsx`, `App.tsx`

### 1.7 Loading Skeletons ✅ DONE (commit `ad039a3`)
- [ ] Create `SkeletonCard.tsx` component (pulsing gray rectangles)
- [ ] Replace "Loading..." text in DashboardPage, DocumentPage, EditDocumentPage
- [ ] Add skeleton for PDF thumbnail while loading

**Files:** new `frontend/src/components/SkeletonCard.tsx`, DashboardPage, DocumentPage

---

## Sprint 2 — Notifications & Smart Dashboard

> **Goal:** Make the app proactively useful — reminders, insights, activity feed.

### 2.1 Expiry Reminder Emails
- [ ] Backend: `server/jobs/expiryReminder.js` — daily cron/scheduled job
  - Query: `SELECT * FROM documents WHERE expires_at IS NOT NULL AND expires_at BETWEEN NOW() AND NOW() + INTERVAL 30 DAY AND reminder_sent = FALSE`
  - Send email to document owner (person_id → user email, or uploader)
  - Mark `reminder_sent = TRUE` after sending
  - Configurable thresholds: 30, 14, 7, 1 days
- [ ] Run via: `setInterval` in app.js (simple) or node-cron
- [ ] Email template: "Your [document title] expires on [date]"
- [ ] Admin setting: enable/disable reminders (optional)

**Files:** new `server/jobs/expiryReminder.js`, `server/app.js`, `server/utils/email.js`

### 2.2 Dashboard Widgets
- [ ] **Expiring soon** — top banner/card showing documents expiring in next 30 days
- [ ] **Quick stats row** — 4 cards: total documents, total persons, documents this month, expiring soon count
- [ ] **Recent activity feed** — last 10 audit log entries ("Marco uploaded...", "Ana edited...")
- [ ] Backend: `GET /api/dashboard/stats` — aggregated counts
- [ ] Backend: `GET /api/dashboard/expiring` — expiring documents
- [ ] Backend: `GET /api/dashboard/activity` — recent audit entries
- [ ] Reorganize DashboardPage: stats on top, then filters + list below

**Files:** new `server/routes/dashboard.js`, `frontend/src/pages/DashboardPage.tsx`, locale files

### 2.3 Related Documents on Detail Page
- [ ] On DocumentPage, show "Other documents for [person]" (query: same person_id, limit 5)
- [ ] Show "Other documents from [institution]" (if institution_id set, limit 5)
- [ ] Display as small linked cards below the metadata section

**Files:** `server/routes/documents.js` (or new endpoint), `frontend/src/pages/DocumentPage.tsx`

---

## Sprint 3 — Upload Experience & Bulk Operations

> **Goal:** Make uploading fast and efficient for families scanning multiple docs.

### 3.1 Drag-and-Drop Upload
- [ ] Add drop zone to UploadPage with visual feedback (dashed border, highlight on drag)
- [ ] Support both drag-and-drop and click-to-browse
- [ ] Show file name and size after selection
- [ ] No new dependencies needed (native HTML5 drag events)

**Files:** `frontend/src/pages/UploadPage.tsx`

### 3.2 Multi-File Upload
- [ ] Backend: accept multiple files in single request (multer `.array('files', 10)`)
- [ ] OR: sequential uploads from frontend with shared metadata
- [ ] Frontend: upload queue with individual progress bars
- [ ] Each file gets its own metadata form (or shared metadata for batch)
- [ ] "Quick upload" mode: upload now, add metadata later (status: "untagged")

**Files:** `server/routes/documents.js`, `server/utils/fileStorage.js`, `frontend/src/pages/UploadPage.tsx`

### 3.3 Bulk Operations
- [ ] Add checkboxes to document list (multi-select mode)
- [ ] Bulk actions bar: "Tag selected", "Delete selected", "Change category"
- [ ] Backend: `POST /api/documents/bulk` — accepts array of UUIDs + action
- [ ] Owner/admin check for bulk delete

**Files:** `server/routes/documents.js`, `frontend/src/pages/DashboardPage.tsx`

### 3.4 Upload Presets/Templates
- [ ] New table: `upload_presets` (id, name, category_id, institution_id, tags JSON, user_id)
- [ ] Admin or user can save a preset: "Vet visit" = category:vaccines + institution:vet-clinic + tag:pet
- [ ] Dropdown on upload form: "Use preset..." → auto-fills fields
- [ ] Backend: CRUD for presets

**Files:** `server/db/schema.sql`, new `server/routes/presets.js`, `frontend/src/pages/UploadPage.tsx`

---

## Sprint 4 — PWA & Mobile Experience

> **Goal:** Make it feel like a native app on iPhone.

### 4.1 PWA Manifest & Icons
- [ ] Create `public/manifest.json` — name, icons (192x192, 512x512), theme color, display: standalone
- [ ] Add `<link rel="manifest">` to `index.html`
- [ ] Create app icons (blue "DF" logo or similar)
- [ ] iOS-specific meta tags (already partial in index.html)
- [ ] Test "Add to Home Screen" on iPhone Safari

**Files:** `frontend/public/manifest.json`, `frontend/index.html`, icon files

### 4.2 Service Worker (Offline Support)
- [ ] Install `vite-plugin-pwa` for automatic service worker generation
- [ ] Cache strategy: app shell (cache-first), API calls (network-first), PDF files (cache with network fallback)
- [ ] Offline page: "You're offline — showing cached documents"
- [ ] Cache recently viewed document metadata + PDF files

**Files:** `frontend/vite.config.ts`, `frontend/package.json`

### 4.3 Mobile Navigation
- [ ] Bottom navigation bar for mobile (Upload, Home, Account) — visible only on small screens
- [ ] Hide top nav upload/account links on mobile (shown in bottom bar)
- [ ] Floating Action Button (FAB) for quick upload on mobile

**Files:** `frontend/src/components/Layout.tsx`, new `frontend/src/components/BottomNav.tsx`

### 4.4 Camera Capture
- [ ] Add `capture="environment"` option to file input on mobile
- [ ] "Scan document" button that opens camera directly
- [ ] Detect mobile via user agent or `matchMedia`

**Files:** `frontend/src/pages/UploadPage.tsx`

---

## Sprint 5 — Dark Mode & Accessibility

> **Goal:** Polish, inclusivity, and modern UX expectations.

### 5.1 Dark Mode
- [ ] Add dark mode CSS using Tailwind `dark:` variant
- [ ] Theme toggle in nav (sun/moon icon) alongside language switcher
- [ ] Respect system preference (`prefers-color-scheme: dark`)
- [ ] Persist choice in localStorage (`df_theme`)
- [ ] Update all components with `dark:` classes

**Files:** `frontend/src/index.css`, `frontend/src/components/Layout.tsx`, all pages

### 5.2 Accessibility (a11y)
- [ ] Add `aria-label` to all icon buttons and interactive elements
- [ ] Add `role` attributes where semantic HTML is insufficient
- [ ] Keyboard navigation: Tab through document list, Enter to open
- [ ] Focus management after navigation (auto-focus first result)
- [ ] Skip-to-content link
- [ ] Verify color contrast ratios (WCAG AA)
- [ ] Screen reader testing

**Files:** all frontend components

### 5.3 Category Translations
- [ ] Categories and institutions should be translatable
- [ ] Option A: add `name_de`, `name_es` columns to categories/institutions
- [ ] Option B: i18n keys mapped to slugs (e.g., `categories.working-attestation`)
- [ ] Display translated category names in filters and document cards

**Files:** locale files, DashboardPage, DocumentPage, UploadPage, EditDocumentPage

---

## Sprint 6 — Data Management & Export

> **Goal:** Data integrity, export, and operational tooling.

### 6.1 Export All Documents
- [ ] Backend: `GET /api/documents/export` — generates ZIP with all PDFs + metadata.csv
- [ ] Stream ZIP response (archiver library)
- [ ] Include folder structure matching filesystem layout
- [ ] Admin-only endpoint

### 6.2 Duplicate Detection
- [ ] Compute file hash (SHA-256) on upload, store in `documents.file_hash` column
- [ ] On upload, check if hash exists — warn user "This file may already exist as [title]"
- [ ] Schema change: add `file_hash CHAR(64)` to documents table

### 6.3 Database Cleanup Cron
- [ ] Expired sessions cleanup (already configured in session store, verify)
- [ ] Old audit log pruning (e.g., delete entries > 1 year, admin configurable)
- [ ] Orphaned file detection (files on disk without DB record, and vice versa)

### 6.4 Storage Stats in Admin
- [ ] Total storage used (sum of file_size)
- [ ] Storage per person, per category
- [ ] Display in admin dashboard or settings page

---

## Backlog (Future Sprints)

- [x] ~~OCR pipeline~~ — PDF text extraction implemented via pdf-parse (text layer only; Tesseract for images is future)
- [x] ~~Auto-matching rules engine~~ — textMatcher.js implements all 5 algorithms
- [x] ~~Email-to-document ingestion~~ — IMAP polling, whitelist, auto-classify, confirmation email
- [ ] Document linking (explicit relationships between docs)
- [ ] Bulk import from Paperless-ngx
- [ ] Weekly digest email

- [ ] Session management (view/revoke active sessions)
- [ ] Thumbnail generation cache (avoid re-rendering PDF on every view)
- [ ] Document comparison (diff between versions)
- [ ] Push notifications (Web Push API for expiry reminders)
- [ ] Search result highlighting

---

## Security Checklist (Reference)

| Measure | Status | Where |
|---------|--------|-------|
| HTTPS enforcement | ✅ | Cloudflare Tunnel |
| Parameterized SQL queries | ✅ | All routes |
| bcrypt password hashing (cost 10) | ✅ | auth.js, admin/users.js |
| Session cookies: httpOnly, secure, sameSite | ✅ | app.js |
| Content Security Policy | ✅ | app.js (Helmet) |
| CORS restricted to domain | ✅ | app.js |
| Rate limiting (login, upload, admin, API) | ✅ | rateLimit.js, app.js |
| Honeypot on login | ✅ | LoginPage.tsx, auth.js |
| Account lockout (5 attempts / 15 min) | ✅ | auth.js |
| Login/logout audit logging | ✅ | auth.js, audit.js |
| Input sanitization (HTML strip) | ✅ | sanitize.js |
| Owner-only delete | ✅ | documents.js |
| File type validation (PDF only) | ✅ | fileStorage.js |
| File size limit (25 MB) | ✅ | fileStorage.js |
| UUID-based file paths | ✅ | fileStorage.js |
| Webhook HMAC-SHA256 validation | ✅ | deploy.js |
| X-Frame-Options / frame-ancestors | ✅ | Helmet CSP |
| Password complexity rules | ✅ | validation.js (min 8 + letter + number) |
| Session idle timeout (30 min) | ✅ | app.js middleware |
| Document CRUD audit logging | ✅ | documents.js (create, update, delete) |
| Admin user create audit logging | ✅ | admin/users.js |
| File path traversal check | ✅ | documents.js (isSafeFilePath) |
| Permissions-Policy header | ⬜ | Sprint 1.1 remaining |
| Password reset with token | ⬜ | Sprint 1.4 |
| Duplicate file detection | ⬜ | Sprint 6.2 |

---

## How to Resume

1. Open this file: `SPRINT.md` in project root
2. Find the first unchecked `[ ]` item in the current sprint
3. Start working from there
4. Mark items `[x]` as completed
5. Commit after each logical unit of work
6. Push to `claude/plan-database-schema-pe7Y7`
