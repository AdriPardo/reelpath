# Backups

## Objetivo

Poder recuperar la base de datos ante:

- borrado accidental
- corrupción
- migración fallida
- pérdida del VPS/volumen

## Requisitos

- `DATABASE_URL` apuntando a Postgres (misma cadena que usa API/worker)
- utilidades `pg_dump` y `psql` disponibles en el host donde se ejecuta el backup

## Scripts

- `scripts/backup-db.sh`: genera un `.sql.gz`
- `scripts/restore-db.sh`: restaura desde un `.sql.gz`
- `scripts/backup-storage.sh`: backup del `STORAGE_PATH` (archivos) a `.tar.gz` (+ opcional S3)

Ejemplo:

```bash
export DATABASE_URL="postgresql://autotube:***@localhost:5433/autotube"
export STORAGE_PATH="./storage"
./scripts/backup-db.sh ./backups/autotube_$(date +%F).sql.gz
./scripts/restore-db.sh ./backups/autotube_2026-07-13.sql.gz

# Storage (archivos generados: vídeos, clips, assets…)
./scripts/backup-storage.sh ./backups --keep 14
```

## Backup de storage (archivos)

El storage **no** está dentro de Postgres: contiene los archivos generados (renders, audios, imágenes, clips…).
Para un restore completo tras pérdida de disco/volumen necesitas:

- DB (`scripts/backup-db.sh` / `scripts/restore-db.sh`)
- Storage (`scripts/backup-storage.sh`)

### Restore de storage (local)

El script genera un `storage_YYYY-MM-DD_HHMMSS.tar.gz`. Para restaurar:

```bash
export STORAGE_PATH="./storage"
mkdir -p "$STORAGE_PATH"
tar -C "$STORAGE_PATH" -xzf ./backups/storage_2026-07-13_031500.tar.gz
```

### Subida a S3 (opcional)

Si quieres guardar copias fuera del servidor, define `STORAGE_BACKUP_S3_URI` (sin credenciales en repo; usa perfiles/roles del host):

```bash
export STORAGE_PATH="./storage"
export STORAGE_BACKUP_S3_URI="s3://mi-bucket/reelpath/storage"
./scripts/backup-storage.sh ./backups --keep 14
```

Recomendaciones:

- Activa versionado del bucket y políticas de retención.
- Considera cifrado (SSE-S3 o SSE-KMS) y bloqueo de borrado (Object Lock) si aplica.

## Ejemplo de cron (VPS)

Guarda backups en disco local y rota por antigüedad (ejemplo 14 días):

```bash
mkdir -p /var/backups/reelpath
crontab -e
```

Entrada diaria a las 03:15:

```cron
15 3 * * * cd /srv/reelpath && DATABASE_URL="$DATABASE_URL" ./scripts/backup-db.sh /var/backups/reelpath/db_$(date +\%F).sql.gz && find /var/backups/reelpath -type f -name "db_*.sql.gz" -mtime +14 -delete
25 3 * * * cd /srv/reelpath && STORAGE_PATH="/srv/reelpath/storage" ./scripts/backup-storage.sh /var/backups/reelpath --keep 14
```

## Recomendación

- Subir backups a un storage externo (S3/Backblaze/Drive) con cifrado.
- Probar restauración **mensualmente** en un entorno staging.

