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

- **Never use `node:20-*` or newer** — use `node:18-slim`
- **Never use `*-alpine` images** for the production stage
- Never put comments on the same line as `RUN`, `COPY`, `FROM`, or other instructions
  - BAD: `RUN npm ci  # install dependencies`
  - GOOD: Comment on a separate line above the instruction
- Use `npm ci --omit=dev` instead of deprecated `--production` flag
- Multi-stage builds and `COPY --from=` are supported
- Use `**/node_modules` in `.dockerignore` (not just `node_modules`) for recursive matching

## Task Scheduler (remote execution)

- There is no browser-based terminal in DSM 7.1.1
- Commands run via **Control Panel > Task Scheduler > Triggered Task > User-defined script**
- Always prefix scripts with:
  ```bash
  export HOME=/root
  git config --global --add safe.directory /volume1/docker/digital_family
  ```
- `$HOME` is not set in Task Scheduler context
- Git will reject operations without the safe.directory exception
- Tasks must run as **root** user to access Docker socket

## Deploy Command Template

```bash
export HOME=/root
git config --global --add safe.directory /volume1/docker/digital_family
cd /volume1/docker/digital_family
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

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
