# Digital Family — Project Brief

## Overview

A self-hosted family document management system for 4 family members. Users scan physical documents with their iPhone (using the built-in document scanner in Notes/Files) and upload the resulting PDFs through a mobile-friendly React UI. Each document is categorized, tagged with metadata (date, title, institution, person), and stored on the Synology NAS filesystem. The app provides fast filtering and search so any family member can instantly find and view or print a document from their phone.

**Domain:** `digitalfamily.carbonnull.ch` (via Cloudflare Tunnel)

## Goals

- Passwordless magic-link login for 4 family members
- Upload PDF documents with metadata (title, date, institution, category, person)
- Categorize documents: working attestation, exams, titles, vaccines, contracts, insurance, ID documents, receipts, medical records, certificates
- Filter and search by category, person, date range, title, institution
- View PDFs inline on mobile (phone-friendly)
- Print or download documents from any device
- Store files on Synology filesystem for easy backup with Hyper Backup
- Store metadata in MariaDB
- Dockerized deployment with CI/CD via GitHub webhooks
- Accessible via Cloudflare Tunnel (HTTPS, no port forwarding)

## Infrastructure

| Component | Details |
|-----------|---------|
| **NAS** | Synology DS713+, DSM 7.1.1 update 9 |
| **Domain** | `digitalfamily.carbonnull.ch` |
| **Tunnel** | Cloudflare Tunnel (cloudflared in Docker) |
| **Database** | MariaDB 10.x (Docker container) |
| **Runtime** | Node.js 20 LTS (Docker container) |
| **Storage** | `/volume1/digital_family/uploads/` (NAS filesystem, bind-mounted into Docker) |
| **Backup** | Hyper Backup covers `/volume1/digital_family/` |

## Tech Stack

### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js
- **Database:** MariaDB 10.x with `mysql2` driver
- **Auth:** Magic link (passwordless email) with `crypto.randomBytes(32)`, 15-minute expiry
- **Email:** Nodemailer with SMTP (for magic links and notifications)
- **File handling:** Multer for PDF uploads
- **Module system:** ES Modules (`import`/`export`)

### Frontend
- **Framework:** React 18+ with TypeScript
- **Build tool:** Vite
- **Styling:** Tailwind CSS
- **Routing:** React Router v6
- **Forms:** React Hook Form
- **PDF viewing:** `react-pdf` or browser-native PDF viewer
- **HTTP client:** Axios
- **Mobile-first:** Responsive design optimized for iPhone

### DevOps
- **Containerization:** Docker + Docker Compose
- **CI/CD:** GitHub webhook → auto-pull + rebuild on NAS
- **Process manager:** Docker restart policies (no PM2 needed)
- **Reverse proxy:** Cloudflare Tunnel (cloudflared)

## Application Structure

```
digital_family/
├── .claude/                    # Claude Code configuration
│   ├── agents/                 # code-reviewer, db-analyst, security-auditor
│   ├── commands/               # deploy, fix-issue, review, db-migrate, test-routes
│   ├── rules/                  # code-style, database, security, testing, ejs-templates
│   └── skills/                 # deploy, react-frontend, security-review
├── CLAUDE.md                   # This file
├── docker-compose.yml          # MariaDB + App + Cloudflared
├── Dockerfile                  # Multi-stage: build React → serve with Express
├── .dockerignore
├── .gitignore
├── .env.example                # Environment variable template
├── package.json                # Backend dependencies + scripts
├── server/                     # Backend (Express API)
│   ├── app.js                  # Express app setup
│   ├── db/
│   │   ├── connection.js       # MariaDB pool (mysql2)
│   │   └── schema.sql          # Full database schema
│   ├── middleware/
│   │   ├── requireAuth.js      # Session-based auth check
│   │   └── rateLimit.js        # Rate limiting for login
│   ├── routes/
│   │   ├── auth.js             # Magic link login/verify
│   │   ├── documents.js        # CRUD + upload + search
│   │   ├── categories.js       # Category listing
│   │   └── users.js            # Family member profiles
│   └── utils/
│       ├── email.js            # Nodemailer magic link sender
│       └── fileStorage.js      # File path management
├── frontend/                   # React app (Vite + TypeScript)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── components/         # Reusable UI components
│       ├── pages/              # Route-level views
│       ├── hooks/              # Custom hooks (useAuth, useDocuments)
│       ├── services/           # API client functions
│       ├── context/            # Auth context, app state
│       └── types/              # Shared TypeScript interfaces
├── scripts/
│   ├── deploy.sh               # Webhook-triggered deploy script
│   └── docker-webhook-watcher.sh  # Listens for GitHub push events
├── uploads/                    # Bind-mount point → /volume1/digital_family/uploads/
│   └── .gitkeep
└── test/
    ├── routes.test.js
    └── database.test.js
```

## Database Schema

### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT AUTO_INCREMENT | Primary key |
| `email` | VARCHAR(255) UNIQUE | Login identifier |
| `first_name` | VARCHAR(100) | Display name |
| `last_name` | VARCHAR(100) | Family name |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `magic_tokens`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT AUTO_INCREMENT | Primary key |
| `user_id` | INT | FK → users.id |
| `token` | VARCHAR(64) UNIQUE | crypto.randomBytes(32).toString('hex') |
| `used` | BOOLEAN | DEFAULT FALSE |
| `expires_at` | DATETIME | NOW() + 15 minutes |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### `categories`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT AUTO_INCREMENT | Primary key |
| `name` | VARCHAR(100) UNIQUE | Category display name |
| `slug` | VARCHAR(100) UNIQUE | URL-safe identifier |

**Default categories:** working_attestation, exams, titles, vaccines, contracts, insurance, id_documents, receipts, medical_records, certificates

### `documents`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT AUTO_INCREMENT | Primary key |
| `uuid` | CHAR(36) UNIQUE | Public identifier (used in file paths) |
| `user_id` | INT | FK → users.id (who uploaded) |
| `person_name` | VARCHAR(200) | Which family member the doc belongs to |
| `category_id` | INT | FK → categories.id |
| `title` | VARCHAR(255) | Document title |
| `institution` | VARCHAR(255) | Issuing institution (hospital, school, employer, etc.) |
| `document_date` | DATE | Date on the document |
| `file_path` | VARCHAR(500) | Relative path under uploads/ |
| `file_size` | INT | File size in bytes |
| `original_filename` | VARCHAR(255) | Original upload filename |
| `notes` | TEXT | Optional notes |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | DATETIME | ON UPDATE CURRENT_TIMESTAMP |

**Indexes:** `category_id`, `user_id`, `person_name`, `document_date`, `institution`

## Authentication

Magic link passwordless flow (same pattern as Find_my_owner):

1. User enters email on login page
2. Server generates `crypto.randomBytes(32)` token, stores in `magic_tokens` with 15-minute expiry
3. Email sent with link: `https://digitalfamily.carbonnull.ch/auth/verify?token=<token>`
4. User clicks link → server validates token (not expired, not used), marks `used=TRUE`
5. Server creates session with `userId` → redirects to dashboard
6. Session config: `secure: true`, `httpOnly: true`, `sameSite: 'lax'`

Only 4 pre-registered family members can log in. No self-registration — users are seeded in the database.

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/login` | No | Login page |
| POST | `/auth/login` | No | Send magic link email |
| GET | `/auth/verify` | No | Verify magic link token |
| POST | `/auth/logout` | Yes | Destroy session |

### Documents
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/documents` | Yes | List documents (with filters) |
| GET | `/api/documents/:uuid` | Yes | Get document metadata |
| GET | `/api/documents/:uuid/file` | Yes | Stream PDF file |
| POST | `/api/documents` | Yes | Upload PDF + metadata |
| PUT | `/api/documents/:uuid` | Yes | Update metadata |
| DELETE | `/api/documents/:uuid` | Yes | Delete document + file |

### Categories
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/categories` | Yes | List all categories |

### Users
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/me` | Yes | Current user profile |

### Query Parameters for `GET /api/documents`
- `category` — filter by category slug
- `person` — filter by person_name
- `institution` — filter by institution (partial match)
- `q` — full-text search on title, institution, notes
- `from` / `to` — date range filter on document_date
- `sort` — `date_desc` (default), `date_asc`, `title_asc`, `created_desc`
- `page` / `limit` — pagination (default limit: 20)

## File Storage

```
/volume1/digital_family/uploads/
├── <uuid1>.pdf
├── <uuid2>.pdf
└── ...
```

- Files stored as `<uuid>.pdf` (UUID generated at upload time)
- Original filename preserved in database, not on filesystem
- Path in database: relative (`<uuid>.pdf`)
- Docker bind mount: `/volume1/digital_family/uploads` → `/app/uploads`
- Only PDF files accepted (MIME type validation: `application/pdf`)
- Max file size: 25 MB per upload
- Hyper Backup covers the entire `/volume1/digital_family/` directory

## Docker Setup

### `docker-compose.yml`
```yaml
services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "3456:3456"
    environment:
      - NODE_ENV=production
      - DB_HOST=db
      - DB_PORT=3306
      - DB_NAME=digital_family
    env_file: .env
    volumes:
      - /volume1/digital_family/uploads:/app/uploads
    depends_on:
      - db

  db:
    image: mariadb:10
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_ROOT_PASSWORD}
      - MYSQL_DATABASE=digital_family
      - MYSQL_USER=${DB_USER}
      - MYSQL_PASSWORD=${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
      - ./server/db/schema.sql:/docker-entrypoint-initdb.d/schema.sql

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}

volumes:
  db_data:
```

### `Dockerfile` (multi-stage)
```dockerfile
# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY server/ ./server/
COPY --from=frontend-build /app/frontend/dist ./public/
EXPOSE 3456
CMD ["node", "server/app.js"]
```

## CI/CD via GitHub Webhooks

1. GitHub push to `main` → webhook POST to `https://digitalfamily.carbonnull.ch/deploy`
2. Webhook endpoint validates GitHub signature (`X-Hub-Signature-256`)
3. Triggers `scripts/deploy.sh`:
   ```bash
   cd /volume1/docker/digital_family
   git pull origin main
   docker compose build --no-cache
   docker compose up -d
   ```
4. Deploy route is rate-limited and signature-verified (no auth session needed)

## Cloudflare Tunnel

- Tunnel name: `digital-family`
- Routes `digitalfamily.carbonnull.ch` → `http://app:3456`
- HTTPS termination at Cloudflare edge
- No port forwarding needed on router
- Tunnel token stored in `.env` as `CLOUDFLARE_TUNNEL_TOKEN`

## Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3456
SESSION_SECRET=<random-64-char-string>

# Database
DB_HOST=db
DB_PORT=3306
DB_NAME=digital_family
DB_USER=digital_family
DB_PASSWORD=<strong-password>
DB_ROOT_PASSWORD=<strong-root-password>

# Email (magic links)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASS=<password>
SMTP_FROM=noreply@carbonnull.ch

# Cloudflare
CLOUDFLARE_TUNNEL_TOKEN=<tunnel-token>

# GitHub Webhook
GITHUB_WEBHOOK_SECRET=<webhook-secret>

# File Storage
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=26214400
```

## npm Packages

### Backend (`package.json`)
| Package | Purpose |
|---------|---------|
| `express` | HTTP framework |
| `mysql2` | MariaDB driver with promises |
| `express-session` | Session management |
| `connect-session-knex` or `express-mysql-session` | Session store in MariaDB |
| `multer` | File upload handling |
| `nodemailer` | Magic link emails |
| `helmet` | Security headers |
| `cors` | CORS configuration |
| `express-rate-limit` | Rate limiting |
| `uuid` | Document UUID generation |
| `dotenv` | Environment variable loading |

### Frontend (`frontend/package.json`)
| Package | Purpose |
|---------|---------|
| `react` + `react-dom` | UI framework |
| `react-router-dom` | Client-side routing |
| `react-hook-form` | Form management |
| `axios` | HTTP client |
| `react-pdf` | Inline PDF viewing |
| `tailwindcss` | Utility-first CSS |
| `@tailwindcss/forms` | Form element styling |
| `typescript` | Type safety |
| `vite` | Build tool |

## Common Commands

```bash
# Development
docker compose up -d                       # Start all services
docker compose logs -f app                 # Watch app logs
docker compose exec db mysql -u root -p    # Database shell

# Frontend development (outside Docker)
cd frontend && npm run dev                 # Vite dev server with HMR

# Testing
npm test                                   # Backend tests
cd frontend && npm test                    # Frontend tests

# Deploy
docker compose build --no-cache && docker compose up -d

# Database
docker compose exec db mysql -u digital_family -p digital_family < server/db/schema.sql
```

## Coding Conventions

See `.claude/rules/` for detailed rules. Summary:
- **Backend:** ES Modules, async/await, parameterized SQL queries, Express Router per resource
- **Frontend:** React 18 + TypeScript, functional components, Tailwind CSS, React Hook Form
- **Security:** All routes behind `requireAuth` (except auth + webhook), parameterized queries, escaped output, no secrets in code
- **Testing:** Mocha/Chai/Supertest for backend, React Testing Library + Vitest for frontend
- **Database:** MariaDB, `mysql2` pool with promises, ownership checks on all queries, schema changes reflected in `db/schema.sql`

## Slash Commands

| Command | Description |
|---------|-------------|
| `/review` | Code review: SQL injection, auth middleware, XSS, input validation |
| `/fix-issue <number>` | Read GitHub issue, implement fix, test, commit |
| `/deploy` | Run deployment pre-flight checklist |
| `/db-migrate` | Guide safe MariaDB schema changes |
| `/test-routes` | Audit all routes for auth, methods, validation |

## Agents

| Agent | Purpose |
|-------|---------|
| **code-reviewer** | Reviews Node/Express code for security, auth, and style |
| **db-analyst** | Reviews MariaDB schema, queries, indexes, and data integrity |
| **security-auditor** | OWASP Top 10 audit: injection, auth, XSS, file uploads |

## Skills

| Skill | Purpose |
|-------|---------|
| **deploy** | Full-stack pre-flight checklist (React build + Express + Docker) |
| **react-frontend** | React component creation, state management, build validation |
| **security-review** | Auth/middleware/session security audit |

## Setup Checklist

1. [ ] Clone repo to NAS: `git clone` into `/volume1/docker/digital_family`
2. [ ] Copy `.env.example` → `.env` and fill in all values
3. [ ] Create upload directory: `mkdir -p /volume1/digital_family/uploads`
4. [ ] Set permissions: `chown -R 1000:1000 /volume1/digital_family/uploads`
5. [ ] Start containers: `docker compose up -d`
6. [ ] Verify MariaDB is running: `docker compose exec db mysql -u root -p -e "SHOW DATABASES;"`
7. [ ] Seed database with schema: auto-runs from `docker-entrypoint-initdb.d`
8. [ ] Seed 4 family members in `users` table
9. [ ] Seed default categories in `categories` table
10. [ ] Configure Cloudflare Tunnel: create tunnel, add DNS route for `digitalfamily.carbonnull.ch`
11. [ ] Set `CLOUDFLARE_TUNNEL_TOKEN` in `.env`
12. [ ] Verify HTTPS access: `https://digitalfamily.carbonnull.ch`
13. [ ] Test magic link login flow end-to-end
14. [ ] Configure GitHub webhook: repo Settings → Webhooks → `https://digitalfamily.carbonnull.ch/deploy`
15. [ ] Set `GITHUB_WEBHOOK_SECRET` in `.env` (same as webhook secret in GitHub)
16. [ ] Test webhook: push a commit, verify auto-deploy
17. [ ] Upload a test PDF and verify it appears in the file list
18. [ ] Verify Hyper Backup includes `/volume1/digital_family/`

## Future Extensions

- OCR text extraction from PDFs (searchable content)
- Document expiry reminders (e.g., insurance renewal, vaccine boosters)
- Shared family calendar integration
- Thumbnail generation for document previews
- Bulk upload (multiple PDFs at once)
- Document versioning (re-upload updated version)
- Email notifications when a new document is uploaded
- Export all documents as ZIP archive
- Multi-language support (DE/EN/FR)
