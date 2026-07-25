# Clip desde upload

## Estado

**Implementado (Sprint 3 MVP).** Permite subir un MP4 largo y generar Shorts con el mismo flujo `split_shorts` del pipeline, sin regenerar guion.

## Flujo

1. `POST /api/channels/:id/upload-long` — multipart (`video`), opcional `title`.
2. Validación: MP4, duración ≥ 30 s, límite 500 MB.
3. Almacenamiento en `STORAGE_PATH/uploads/{orgId}/{pipelineRunId}/source.mp4` (y S3 si está configurado).
4. Crea `PipelineRun` (metadata `source: upload`) + `Video` en `pending`.
5. Worker encola `split_shorts` con `splitOnly: true` → clips en revisión.

## Requisitos del canal

- Formato **long** con **YouTube Shorts** activados (`publishYoutubeShorts=true`).

## UI

- Canal → pestaña General: bloque **Subir vídeo largo** (junto al botón de generar).

## Límites

- Cuenta como generación de pipeline (`assertOrgCanTriggerPipeline`).
- Tamaño máximo: 500 MB (MVP).

## Prueba manual

```bash
curl -X POST "http://localhost:4000/api/channels/{CHANNEL_ID}/upload-long" \
  -H "Authorization: Bearer $TOKEN" \
  -F "video=@/ruta/video.mp4" \
  -F "title=Mi documental"
```

Respuesta `202` con `videoId` → abrir `/videos/{videoId}` y esperar clips en Shorts.
