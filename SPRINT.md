# Digital Family — Sprint Plan

> **Branch:** `claude/plan-database-schema-pe7Y7`
> **Last updated:** 2026-04-02
> **Status:** Sprint 1 complete, Sprint 2 ready

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

### Current File Inventory

**Backend:**
- `server/app.js` — Express app, all routes registered
- `server/db/schema.sql` — 12 tables, all indexes, FULLTEXT search
- `server/db/seed.sql` — categories, 4 humans + 2 cats, institutions, tags
- `server/middleware/` — requireAuth, requireAdmin, rateLimit
- `server/routes/auth.js` — email+password login, session, status (returns role)
- `server/routes/documents.js` — CRUD + file stream + owner-only delete + file rename on update
- `server/routes/categories.js`, `institutions.js`, `tags.js` — public listing endpoints
- `server/routes/users.js` — /me + list all
- `server/routes/deploy.js` — GitHub webhook
- `server/routes/admin/users.js` — CRUD + password reset
- `server/routes/admin/metadata.js` — CRUD for categories, institutions, tags, custom fields
- `server/routes/admin/audit.js` — paginated audit log with filters
- `server/utils/fileStorage.js` — slugify, buildDocumentPath, ensureDir, removeEmptyDir, multer
- `server/utils/email.js` — nodemailer (magic link — needs update for password reset)

**Frontend:**
- `frontend/src/i18n/` — config + 3 locale files (en, de, es)
- `frontend/src/context/AuthContext.tsx` — auth state
- `frontend/src/components/Layout.tsx` — nav + language switcher + admin link
- `frontend/src/pages/LoginPage.tsx` — email+password login
- `frontend/src/pages/DashboardPage.tsx` — filters (search, category, person, institution, tag, date range, sort) + document list + pagination
- `frontend/src/pages/DocumentPage.tsx` — PDF preview + metadata + print/share/download/edit/delete
- `frontend/src/pages/UploadPage.tsx` — upload form (person_id, institution_id, expires_at)
- `frontend/src/pages/EditDocumentPage.tsx` — edit metadata + file rename
- `frontend/src/pages/admin/` — SettingsLayout, UsersPage, MetadataPage, AuditLogPage
- `frontend/src/services/api.ts` — all API calls
- `frontend/src/types/index.ts` — TypeScript interfaces

### Known Issues / Debt
- `server/utils/email.js` still has magic link function — needs password reset email
- `magic_tokens` table removed from schema but old email util references it
- No tests exist (test/ directory empty)
- `alert()` used for all user feedback (no toast system)
- No error boundaries in React
- No PWA manifest
- CSP disabled in Helmet

---

## Sprint 1 — Core Quality & Self-Service

> **Goal:** Make the app feel polished and let users manage their own accounts.

### 1.1 Toast Notification System
- [ ] Install `react-hot-toast` (or similar lightweight library)
- [ ] Create a `<Toaster />` wrapper in App.tsx
- [ ] Replace ALL `alert()` calls in frontend with toast:
  - DocumentPage: delete success/error
  - UploadPage: upload error
  - EditDocumentPage: save error
  - LoginPage: login error
  - Admin pages: all CRUD operations
- [ ] Add success toasts for: upload complete, document updated, document deleted
- [ ] Translations for all toast messages (en/de/es)

**Files:** `frontend/package.json`, `frontend/src/App.tsx`, all pages

### 1.2 User Account Page (self-service)
- [ ] Backend: `PUT /api/users/me` — update own first_name, last_name, email
- [ ] Backend: `PUT /api/users/me/password` — change own password (requires current password)
- [ ] Frontend: `AccountPage.tsx` — form with name, email, password change
- [ ] Route: `/account` (protected, any user)
- [ ] Add "Account" link in nav (next to logout)
- [ ] Translations (en/de/es)

**Files:** `server/routes/users.js`, new `frontend/src/pages/AccountPage.tsx`, `App.tsx`, `Layout.tsx`, locale files

### 1.3 Password Reset via Email
- [ ] Backend: `POST /auth/forgot-password` — generate reset token, send email
- [ ] Backend: `POST /auth/reset-password` — verify token, set new password
- [ ] Schema: add `password_reset_tokens` table (or reuse pattern from old magic_tokens)
- [ ] Frontend: "Forgot password?" link on login page
- [ ] Frontend: `ResetPasswordPage.tsx` — enter new password after clicking email link
- [ ] Update `server/utils/email.js` for password reset emails
- [ ] Translations (en/de/es)

**Files:** `server/db/schema.sql`, `server/routes/auth.js`, `server/utils/email.js`, new frontend pages, locale files

### 1.4 Error Boundaries
- [ ] Create `ErrorBoundary.tsx` component (catches React render errors)
- [ ] Wrap the app (or route sections) with error boundary
- [ ] Show a friendly "Something went wrong" page with a "Go home" button
- [ ] Translations (en/de/es)

**Files:** new `frontend/src/components/ErrorBoundary.tsx`, `App.tsx`

### 1.5 Loading Skeletons
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

## Sprint 6 — Data & Security

> **Goal:** Export, integrity, and security hardening.

### 6.1 Export All Documents
- [ ] Backend: `GET /api/documents/export` — generates ZIP with all PDFs + metadata.csv
- [ ] Stream ZIP response (archiver library)
- [ ] Include folder structure matching filesystem layout
- [ ] Admin-only endpoint

### 6.2 Duplicate Detection
- [ ] Compute file hash (SHA-256) on upload, store in `documents.file_hash` column
- [ ] On upload, check if hash exists — warn user "This file may already exist as [title]"
- [ ] Schema change: add `file_hash CHAR(64)` to documents table

### 6.3 Audit Log Integration
- [ ] Actually write to audit_log from all routes (currently the table exists but nothing writes to it)
- [ ] Create `server/utils/audit.js` helper: `logAudit(userId, action, entityType, entityId, entityUuid, details, ip)`
- [ ] Add audit calls to: document CRUD, login/logout, admin operations, file downloads
- [ ] IP address from `req.ip` or `req.headers['x-forwarded-for']`

### 6.4 Content Security Policy
- [ ] Configure Helmet CSP properly (currently disabled)
- [ ] Allow: self, PDF viewer, CDN resources
- [ ] Test that PDF preview and all features still work

### 6.5 Rate Limiting on Admin Routes
- [ ] Add rate limiter to admin API endpoints
- [ ] Separate limits for admin vs. regular API

---

## Backlog (Future Sprints)

- [ ] OCR pipeline (Tesseract.js or external service → populate `extracted_text`)
- [ ] Auto-matching rules engine (use `matching_rules` table + `extracted_text`)
- [ ] Document linking (explicit relationships between docs)
- [ ] Bulk import from Paperless-ngx
- [ ] Storage stats in admin dashboard
- [ ] Weekly digest email
- [ ] Two-factor authentication
- [ ] Session management (view/revoke active sessions)
- [ ] Database cleanup cron (expired sessions, old audit logs)
- [ ] Thumbnail generation cache (avoid re-rendering PDF on every view)
- [ ] Document comparison (diff between versions)

---

## How to Resume

1. Open this file: `SPRINT.md` in project root
2. Find the first unchecked `[ ]` item in the current sprint
3. Start working from there
4. Mark items `[x]` as completed
5. Commit after each logical unit of work
6. Push to `claude/plan-database-schema-pe7Y7`
