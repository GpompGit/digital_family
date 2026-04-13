#!/bin/bash
# =============================================================================
# deploy.sh — Daily auto-deploy for Synology NAS (DS713+)
# =============================================================================
# Pulls latest code from GitHub, rebuilds if changes detected, and restarts.
# Designed to run as a Synology Task Scheduler daily task (user: root).
# =============================================================================

set -e

export HOME=/root
export PATH=/usr/local/bin:$PATH
git config --global --add safe.directory /volume1/docker/digital_family

cd /volume1/docker/digital_family

echo "=== Deploy started at $(date) ==="

# Check for new commits
git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "No changes detected. Skipping deploy."
  exit 0
fi

echo "New commits found. Deploying..."
git pull origin main

echo "Rebuilding app container..."
docker-compose build --no-cache app

echo "Restarting services..."
docker-compose down
docker-compose up -d

echo "=== Deploy complete at $(date) ==="
