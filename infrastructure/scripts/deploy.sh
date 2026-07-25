#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> Building images..."
docker compose build

echo "==> Starting services..."
docker compose up -d postgres redis

echo "==> Waiting for postgres..."
sleep 5

echo "==> Running migrations & seed..."
docker compose run --rm api sh -c "npm run migrate:deploy -w @autotube/database && npm run seed -w @autotube/database" || true

echo "==> Starting app stack..."
docker compose up -d api worker frontend

echo "==> AutoTube deployed"
echo "    Frontend: http://localhost:3000"
echo "    API:      http://localhost:4000/health"
