---
name: deploy
description: Full-stack deploy pre-flight checklist for React + Node/Express applications
---

# Deploy Pre-Flight Checklist

Run this checklist before every deployment.

## 1. No Debug Code
- Search all `.js`, `.jsx`, `.ts`, `.tsx` files for `console.log` statements
- Allow informational server logs (`console.info`, `console.warn`, `console.error`)
- Flag any `debugger` statements
- Check for commented-out code blocks

## 2. No Hardcoded Secrets
- Search `.js`, `.jsx`, `.ts`, `.tsx`, `.ejs` files for passwords, API keys, tokens, IPs
- All secrets must come from `process.env`
- Verify `.env` is in `.gitignore`

## 3. Environment Variables
- Compare `.env.example` with all `process.env.*` usage in source code
- Flag any missing variables in `.env.example`
- Verify default values are safe for production

## 4. Backend Checks
- Schema: Compare `db/schema.sql` with actual CREATE/ALTER TABLE statements
- Dependencies: Verify all `require()` / `import` calls match `package.json`
- Routes: All routes have proper auth middleware
- Error handling: No stack traces exposed to clients

## 5. Frontend Checks (React)
- Run `npm run build` in the frontend directory — must complete without errors
- No TypeScript errors (`npx tsc --noEmit`)
- No ESLint errors (`npx eslint src/`)
- API base URL configured via environment variable (not hardcoded)
- Assets optimized (images, fonts)
- `index.html` has correct meta tags

## 6. Integration
- Backend API endpoints match frontend API calls
- CORS configured correctly for production domain
- Authentication flow works end-to-end (login → token → API call)
- WebSocket connections (if any) use correct production URLs

## 7. Git Status
- Working tree is clean
- No untracked files that should be committed
- `.gitignore` includes: `node_modules/`, `.env`, `dist/`, `build/`, `*.log`

## 8. Tests
- Backend tests pass: `npm test`
- Frontend tests pass: `cd frontend && npm test`
- No skipped or pending tests without explanation

## Output Format

For each check, report:
- **PASS** or **FAIL** with details
- Final verdict: **GO** or **NO-GO**
- List all FAIL items that must be fixed before deployment
