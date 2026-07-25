#!/usr/bin/env bash
set -euo pipefail

# Backup PostgreSQL database to a gzip file.
#
# Usage:
#   DATABASE_URL="postgresql://user:pass@host:5432/db" ./scripts/backup-db.sh ./backups/autotube.sql.gz
#
# Notes:
# - No secrets are embedded; uses DATABASE_URL from env.
# - Requires: pg_dump, gzip

OUT_FILE="${1:-}"
if [[ -z "${OUT_FILE}" ]]; then
  echo "Usage: DATABASE_URL=... $0 <output.sql.gz>" >&2
  exit 2
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL no está definido" >&2
  exit 2
fi

mkdir -p "$(dirname "${OUT_FILE}")"

echo "[backup-db] dumping to ${OUT_FILE}"
pg_dump --no-owner --no-privileges --format=plain "${DATABASE_URL}" | gzip -c > "${OUT_FILE}"
echo "[backup-db] OK"

