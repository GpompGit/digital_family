# =============================================================================
# Dockerfile — Multi-Stage Build for Digital Family
# =============================================================================
#
# WHAT IS A DOCKERFILE?
# A Dockerfile is a recipe for building a Docker "image" — a portable package
# that contains everything needed to run the application (code, dependencies,
# OS libraries). You can run this image on any machine with Docker installed.
#
# MULTI-STAGE BUILD:
# This Dockerfile has TWO stages:
#   Stage 1: Build the React frontend (compile TypeScript, bundle with Vite)
#   Stage 2: Create the production image (Node.js server + compiled frontend)
#
# Why two stages? The frontend build needs devDependencies (TypeScript, Vite,
# Tailwind, etc.) that are NOT needed in production. By using two stages,
# the final image is much smaller because it only contains production code.
#
# Think of it like cooking: Stage 1 is the kitchen (messy, lots of tools).
# Stage 2 is the plate you serve (clean, only the finished dish).
#
# ALPINE LINUX:
# We use "node:20-alpine" which is Node.js on Alpine Linux — a tiny Linux
# distribution (~5MB vs ~100MB for Ubuntu). Smaller image = faster deploys.
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build the React frontend
# ---------------------------------------------------------------------------
# This stage compiles TypeScript to JavaScript, processes Tailwind CSS,
# and bundles everything into optimized static files (HTML, JS, CSS) in /dist.
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Copy package files first (before source code).
# Docker caches each layer — if package.json hasn't changed, npm ci is skipped.
# This makes rebuilds much faster when only source code changes.
COPY frontend/package*.json ./
# "clean install" — exactly matches package-lock.json
RUN npm ci

# Copy ALL frontend source files
COPY frontend/ ./
# Compile TypeScript + bundle with Vite → outputs to /dist
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Production server
# ---------------------------------------------------------------------------
# This is the FINAL image that runs in production.
# It contains only: Node.js, production npm packages, server code, and built frontend.
FROM node:20-alpine
WORKDIR /app

# Install ONLY production dependencies (no devDependencies like mocha, vitest, etc.)
COPY package*.json ./
RUN npm ci --production

# Copy the Express backend code
COPY server/ ./server/

# Copy the compiled frontend from Stage 1 into /public
# (Express serves these as static files — see app.js)
COPY --from=frontend-build /app/frontend/dist ./public/

# Create the uploads directory inside the container.
# In production, this is bind-mounted to the NAS (see docker-compose.yml).
RUN mkdir -p /app/uploads

# Document which port the app listens on (informational — doesn't actually open it)
EXPOSE 3456

# The command that runs when the container starts
CMD ["node", "server/app.js"]
