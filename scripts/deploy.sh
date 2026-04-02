#!/bin/bash
set -e

cd /volume1/docker/digital_family

echo "Pulling latest code..."
git pull origin main

echo "Rebuilding containers..."
docker compose build --no-cache

echo "Restarting services..."
docker compose up -d

echo "Deploy complete at $(date)"
