#!/usr/bin/env bash
set -euo pipefail

# Backup del storage (STORAGE_PATH) a un .tar.gz local y, opcionalmente, a S3.
#
# Uso:
#   STORAGE_PATH="./storage" ./scripts/backup-storage.sh ./backups
#   STORAGE_PATH="./storage" ./scripts/backup-storage.sh ./backups --keep 14
#
# Subir a S3 (requiere awscli configurado en el host, sin credenciales en repo):
#   STORAGE_PATH="./storage" STORAGE_BACKUP_S3_URI="s3://mi-bucket/reelpath/storage" ./scripts/backup-storage.sh ./backups
#
# Notas:
# - No incluye credenciales; depende de variables de entorno y/o perfiles del host.
# - Requiere: tar, gzip. Para S3: aws

DEST_DIR="${1:-}"
shift || true

KEEP=14
EXCLUDES=(
  "--exclude=.DS_Store"
  "--exclude=**/.DS_Store"
)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep)
      KEEP="${2:-}"
      shift 2
      ;;
    --exclude)
      EXCLUDES+=("--exclude=${2:-}")
      shift 2
      ;;
    -h|--help)
      echo "Uso: STORAGE_PATH=... $0 <dest_dir> [--keep N] [--exclude PATTERN]" >&2
      exit 0
      ;;
    *)
      echo "Argumento desconocido: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "${DEST_DIR}" ]]; then
  echo "Uso: STORAGE_PATH=... $0 <dest_dir> [--keep N]" >&2
  exit 2
fi

if [[ -z "${STORAGE_PATH:-}" ]]; then
  echo "ERROR: STORAGE_PATH no está definido" >&2
  exit 2
fi

if [[ ! -d "${STORAGE_PATH}" ]]; then
  echo "ERROR: STORAGE_PATH no existe o no es directorio: ${STORAGE_PATH}" >&2
  exit 2
fi

mkdir -p "${DEST_DIR}"

TS="$(date +%Y-%m-%d_%H%M%S)"
OUT_FILE="${DEST_DIR%/}/storage_${TS}.tar.gz"

echo "[backup-storage] empaquetando ${STORAGE_PATH} -> ${OUT_FILE}"
tar -C "${STORAGE_PATH}" "${EXCLUDES[@]}" -czf "${OUT_FILE}" .
echo "[backup-storage] OK (local)"

if [[ -n "${STORAGE_BACKUP_S3_URI:-}" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "ERROR: awscli no está instalado, pero STORAGE_BACKUP_S3_URI está definido" >&2
    exit 2
  fi
  echo "[backup-storage] subiendo a S3 -> ${STORAGE_BACKUP_S3_URI}/storage_${TS}.tar.gz"
  aws s3 cp "${OUT_FILE}" "${STORAGE_BACKUP_S3_URI%/}/storage_${TS}.tar.gz"
  echo "[backup-storage] OK (S3)"
fi

if [[ "${KEEP}" =~ ^[0-9]+$ ]] && [[ "${KEEP}" -gt 0 ]]; then
  mapfile -t files < <(ls -1t "${DEST_DIR%/}"/storage_*.tar.gz 2>/dev/null || true)
  if [[ "${#files[@]}" -gt "${KEEP}" ]]; then
    echo "[backup-storage] rotación: manteniendo ${KEEP}, borrando $(( ${#files[@]} - KEEP ))"
    for ((i=KEEP; i<${#files[@]}; i++)); do
      rm -f "${files[$i]}"
    done
  fi
fi

