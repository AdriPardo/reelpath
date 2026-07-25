# Alertas externas (Sentry / Prometheus)

Este documento describe **qué alertar** y deja **plantillas** para configurar alertas en sistemas externos.
Está pensado para un release “production-grade” sin depender de credenciales reales en el repositorio.

## Sentry (API, worker, frontend)

### Reglas recomendadas

- **Errores no manejados (backend)**
  - **Severidad**: `error` o superior
  - **Filtro**: `environment=production`
  - **Umbral**: > 5 eventos en 5 minutos
  - **Acción**: notificar a Slack / email on-call

- **Picos de errores (frontend)**
  - **Severidad**: `error` o superior
  - **Umbral**: incremento > 2x vs baseline (o > N eventos/min)
  - **Acción**: notificar (no paginar si no hay impacto)

- **Errores de jobs/pipelines (worker)**
  - **Condición**: error en paso del pipeline (por ejemplo, “failed” en render/publish)
  - **Umbral**: > 3 fallos en 15 minutos
  - **Acción**: paginar si afecta a producción (colas atascadas, fallos masivos)

- **Fallo de pagos / facturación**
  - **Condición**: eventos tipo “past_due”, “payment_failed” (si se registran en Sentry)
  - **Acción**: notificar al canal de facturación/soporte (no on-call técnico salvo degradación)

### Checklist de configuración

- **Environments**: separar `development`, `staging`, `production`.
- **Release tracking**: configurar releases para correlacionar despliegues con regresiones.
- **Sampling**: en frontend, limitar captura para evitar ruido (si aplica).
- **PII**: revisar que no se envía email/tokens en breadcrumbs o mensajes.

## Prometheus (API)

La API expone métricas en `GET /metrics` (Prometheus format). Las reglas abajo son ejemplos; ajústalas
a tus nombres de job/targets y a tu SLO.

### Ejemplo de `scrape_config`

```yaml
scrape_configs:
  - job_name: autotube-api
    metrics_path: /metrics
    static_configs:
      - targets: ["api:4000"]
```

### Reglas de alertas (plantillas)

```yaml
groups:
  - name: autotube-api
    rules:
      - alert: ApiDown
        expr: up{job="autotube-api"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "API caída"
          description: "El target Prometheus del API no responde (up=0) durante 2m."

      - alert: ApiHigh5xxRate
        expr: |
          (
            sum(rate(http_requests_total{job="autotube-api",status=~"5.."}[5m]))
            /
            sum(rate(http_requests_total{job="autotube-api"}[5m]))
          ) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tasa alta de 5xx"
          description: "Más del 5% de las respuestas del API son 5xx (5m)."

      - alert: ApiLatencyP95High
        expr: |
          histogram_quantile(
            0.95,
            sum by (le) (rate(http_request_duration_seconds_bucket{job="autotube-api"}[5m]))
          ) > 1.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Latencia p95 elevada"
          description: "La latencia p95 supera 1.5s durante 10m."

      - alert: ProcessMemoryHigh
        expr: process_resident_memory_bytes{job="autotube-api"} > 1.5e9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Memoria alta en API"
          description: "RSS > 1.5GB durante 10m. Revisar fugas/requests grandes."
```

Notas:

- Los nombres de métricas `http_requests_total` y `http_request_duration_seconds_bucket` dependen del
  middleware/stack. Si aún no se exponen, usa estas reglas como plantilla y ajusta cuando exista la métrica.
- Para colas, si exponéis métricas de Bull/Redis (p. ej. longitud de cola), añadid alertas tipo
  `queue_length > umbral` o “tiempo en cola p95”.

## Checklist de dashboards

- **API**
  - Requests/s, errores 4xx/5xx, latencia p50/p95/p99
  - Saturación: CPU, memoria, GC pauses (si se expone), open file descriptors
- **DB**
  - conexiones, locks, slow queries (según exporter)
- **Redis/colas**
  - uso memoria, evictions, latencia
  - longitud de cola, jobs fallidos, jobs reintentados
- **Storage**
  - uso de disco y crecimiento (ideal: alerta por % y por “bytes libres”)

