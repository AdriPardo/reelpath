#!/usr/bin/env bash
set -euo pipefail

# Restore PostgreSQL database from a gzip backup.
#
# Usage:
#   DATABASE_URL="postgresql://user:pass@host:5432/db" ./scripts/restore-db.sh ./backups/autotube.sql.gz
#
# Notes:
# - This will run psql against DATABASE_URL.
# - Requires: psql, gunzip

IN_FILE="${1:-}"
if [[ -z "${IN_FILE}" ]]; then
  echo "Usage: DATABASE_URL=... $0 <input.sql.gz>" >&2
  exit 2
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL no está definido" >&2
  exit 2
fi

if [[ ! -f "${IN_FILE}" ]]; then
  echo "ERROR: backup no encontrado: ${IN_FILE}" >&2
  exit 2
fi

echo "[restore-db] restoring from ${IN_FILE}"
gunzip -c "${IN_FILE}" | psql "${DATABASE_URL}"
echo "[restore-db] OK"

