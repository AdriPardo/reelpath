# Retención y borrado

## Objetivo

- Permitir a una organización **borrar su contenido** (vídeos, pipelines, credenciales por canal) bajo demanda.
- Limpiar **artefactos** antiguos del storage (local/S3) por retención de días.

## Borrado bajo demanda (org)

La plataforma debe exponer un endpoint administrativo para purgar todos los canales de una organización (y su contenido asociado).

> Implementación: borra canales (cascade en BD) y limpia storage por pipeline run.

## Limpieza por retención (storage)

Script cronable:

- `scripts/retention-cleanup.ts`
- Por defecto borra artefactos de `PipelineRun` con `completedAt` anterior a `RETENTION_DAYS` (default 30).

Ejemplo:

```bash
RETENTION_DAYS=30 dotenv -e .env -- tsx scripts/retention-cleanup.ts
```

### Cron recomendado (VPS)

Ejecuta a las 02:40 todos los días:

```cron
40 2 * * * cd /srv/reelpath && RETENTION_DAYS=30 dotenv -e .env -- tsx scripts/retention-cleanup.ts >> /var/log/reelpath-retention.log 2>&1
```

## Nota sobre S3

Si el storage está configurado en S3 (ver `@autotube/config`), la limpieza debe ejecutarse en el host con acceso a la misma configuración.

