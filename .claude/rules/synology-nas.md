# Synology NAS Deployment Rules — DS713+ (Intel Atom D2700)

## Hardware Constraints

- **CPU:** Intel Atom D2700 (x86_64, but NO SSE4.2, NO AVX)
- **RAM:** Limited (1-2 GB) — all containers share this
- **DSM:** 7.1.1 update 9
- Node.js 20+ crashes with "Illegal instruction" — V8 requires SSE4.2
- **Use Node.js 18** (last LTS version compatible with this CPU)
- Alpine-based images (`*-alpine`) use musl binaries that crash on this CPU — **use `-slim` (Debian) images**
- Native npm packages (like `bcrypt`) require build tools — **use pure JS alternatives** (`bcryptjs` instead of `bcrypt`)

## Docker Version

- **Docker Compose:** v1.28.5 (Python-based `docker-compose` with hyphen, NOT `docker compose`)
- **Docker Engine:** ~20.10.x
- Always use `docker-compose` in all commands and scripts
- `docker-compose cp` does NOT exist in v1.28.5 — use `docker cp` instead (e.g., `docker cp file.sql digital_family_db_1:/tmp/`)
- `/usr/local/bin` may not be in `PATH` in Task Scheduler — add `export PATH=/usr/local/bin:$PATH`

## docker-compose.yml Rules

- **MUST include `version: "2.4"`** at the top — docker-compose v1 requires it
- Use format 2.4 specifically because:
  - `depends_on` with `condition: service_healthy` only works in 2.1-2.4
  - Format 3.x removed the `condition` syntax
- **Pin image versions** — never use `:latest` or bare tags (e.g., `mariadb:10.11` not `mariadb:10`)
- **Add `start_period`** to healthchecks — the slow CPU needs extra initialization time (60s+)
- Default value syntax `${VAR:-default}` is supported (v1.22+)
- Unset variables without defaults produce warnings — use `${VAR:-}` to suppress

## Dockerfile Rules

- **Runtime stage (Stage 2) MUST use `node:18-slim`** — Node 20+ V8 requires SSE4.2
- **Build stage (Stage 1) can use `node:20-slim`** — it only runs during `docker build`, not on the NAS CPU at runtime. This is needed because Tailwind CSS v4 (`@tailwindcss/oxide`) requires Node 20+ and has native bindings
- **Never use `*-alpine` images** for any stage — musl binaries crash on Atom D2700
- Never put comments on the same line as `RUN`, `COPY`, `FROM`, or other instructions
  - BAD: `RUN npm ci  # install dependencies`
  - GOOD: Comment on a separate line above the instruction
- Use `npm ci --omit=dev` instead of deprecated `--production` flag
- Multi-stage builds and `COPY --from=` are supported
- Use `**/node_modules` in `.dockerignore` (not just `node_modules`) for recursive matching
- When a frontend dependency requires Node 20+, keep it in Stage 1 only — never let it affect the runtime stage

## Task Scheduler (remote execution)

- There is no browser-based terminal in DSM 7.1.1
- Commands run via **Control Panel > Task Scheduler > Triggered Task > User-defined script**
- Always prefix scripts with:
  ```bash
  export HOME=/root
  export PATH=/usr/local/bin:$PATH
  git config --global --add safe.directory /volume1/docker/digital_family
  ```
- `$HOME` is not set in Task Scheduler context
- `/usr/local/bin` (where `docker-compose` lives) is not in `PATH`
- Git will reject operations without the safe.directory exception
- Tasks must run as **root** user to access Docker socket
- Passwords with special characters (`!`, `$`, etc.) must be wrapped in **single quotes** to prevent bash expansion

## Deploy Command Template

```bash
export HOME=/root
export PATH=/usr/local/bin:$PATH
git config --global --add safe.directory /volume1/docker/digital_family
cd /volume1/docker/digital_family
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

## Database Migration

Schema changes are NOT applied automatically on rebuild — `docker-entrypoint-initdb.d`
only runs on first container creation. For existing deployments, run migrations manually:

```bash
docker cp server/db/migrate-001.sql digital_family_db_1:/tmp/migrate.sql
docker-compose exec -T db mysql -u root -p'YOUR_ROOT_PASSWORD' digital_family -e "source /tmp/migrate.sql"
```

- Use `docker cp` (NOT `docker-compose cp` — not available in v1.28.5)
- Use single quotes around passwords with special characters
- Container name is `digital_family_db_1` (project name + service + instance)

## Paths

- Project root: `/volume1/docker/digital_family`
- Upload storage: `/volume1/digital_family/uploads/`
- The `.env` file lives at `/volume1/docker/digital_family/.env` (not in git)

## Networking

- The app listens on port 3456 inside Docker
- External access via Cloudflare Tunnel (cloudflared container)
- Domain: `digitalfamily.carbonnull.ch`
- Another project (quartier-bike-id) runs on port 8080 with its own MariaDB on port 3307

## Package Rules

- **Never use `bcrypt`** — use `bcryptjs` (pure JavaScript, no native compilation)
- Avoid any npm package that requires native compilation (node-gyp, C++ addons)
- If a package has a pure JS alternative, prefer it
- **`pdf-parse` v2 requires Node 20+** (bundles `pdfjs-dist` which needs it) — use lazy loading with graceful fallback on Node 18
- Any package that bundles `pdfjs-dist` v5+ will fail on Node 18 — check engine requirements before adding dependencies
- When a backend dependency requires Node 20+ but is optional, use lazy `import()` inside the function (not top-level) so the app doesn't crash on startup
