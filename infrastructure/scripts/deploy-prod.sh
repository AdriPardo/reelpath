#!/usr/bin/env bash
# Despliegue de AutoTube en producción (VPS + Docker Compose + Caddy HTTPS)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml"

if [[ ! -f .env ]]; then
  echo "ERROR: Crea .env a partir de .env.production.example y rellena DOMAIN, AUTH_SECRET, etc."
  exit 1
fi

# shellcheck disable=SC1091
source .env 2>/dev/null || true

if [[ -z "${DOMAIN:-}" ]]; then
  echo "ERROR: DOMAIN no está definido en .env (ej. app.tudominio.com)"
  exit 1
fi

if [[ "${AUTH_REQUIRED:-true}" == "true" && -z "${AUTH_SECRET:-}" ]]; then
  echo "ERROR: AUTH_SECRET es obligatorio en producción (min. 32 caracteres)"
  exit 1
fi

echo "==> Dominio: https://${DOMAIN}"
echo "==> Construyendo imágenes..."
$COMPOSE build

echo "==> Arrancando Postgres y Redis..."
$COMPOSE up -d postgres redis

echo "==> Esperando Postgres..."
for i in $(seq 1 30); do
  if $COMPOSE exec -T postgres pg_isready -U autotube >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Migraciones de base de datos..."
$COMPOSE run --rm api sh -c "npm run migrate:deploy -w @autotube/database"

echo "==> Seed (planes + admin; sin canales demo)..."
$COMPOSE run --rm -e SEED_DEMO=false api sh -c "npm run seed -w @autotube/database" || true

echo "==> Arrancando stack completo..."
$COMPOSE up -d

echo ""
echo "Reelpath desplegado."
echo "  URL:      https://${DOMAIN}"
echo "  Health:   https://${DOMAIN}/health"
echo "  OAuth CB: https://${DOMAIN}/api/integrations/youtube/callback"
echo ""
echo "Comprueba: curl -s https://${DOMAIN}/health"
