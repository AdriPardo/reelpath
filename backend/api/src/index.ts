import 'dotenv/config';
import 'express-async-errors';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttpImport from 'pino-http';
import { loadConfig } from '@autotube/config';
import {
  importPlatformSecretsFromEnvIfEmpty,
  loadPlatformSecretsOverrides,
  prisma,
} from '@autotube/database';
import { enqueuePipeline, getPipelineQueue } from '@autotube/job-queue';
import client from 'prom-client';
import { initSentryForApi, installSentryErrorHandler, installSentryMiddleware, Sentry } from './lib/sentry.js';
import { getStorageStats } from './lib/storage-stats.js';
import { requireObservabilityAccess } from './middleware/observability-auth.js';
import { authRouter } from './routes/auth.js';
import { channelsRouter } from './routes/channels.js';
import { videosRouter } from './routes/videos.js';
import { pipelinesRouter } from './routes/pipelines.js';
import { analyticsRouter } from './routes/analytics.js';
import { integrationsRouter } from './routes/integrations.js';
import { notificationsRouter } from './routes/notifications.js';
import { systemRouter } from './routes/system.js';
import { billingRouter } from './routes/billing.js';
import { billingWebhookHandler } from './routes/billing-webhook.js';
import { orgRouter } from './routes/org.js';
import { platformRouter } from './routes/platform.js';

const config = loadConfig();
initSentryForApi();
const app = express();

app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: [config.FRONTEND_URL, 'http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
  }),
);
installSentryMiddleware(app);
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  billingWebhookHandler,
);
app.use(express.json());
app.use((pinoHttpImport as unknown as () => express.RequestHandler)());

client.collectDefaultMetrics();

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'reelpath-api',
  });
});

app.get('/health/extended', requireObservabilityAccess, async (_req, res) => {
  const cfg = loadConfig();
  const startedAt = Date.now();

  let dbOk = false;
  let redisOk = false;
  let redisPing: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  try {
    const q = getPipelineQueue();
    await q.waitUntilReady();
    const redis = (await q.client) as unknown as { ping?: () => Promise<string> };
    redisPing = redis.ping ? await redis.ping() : null;
    redisOk = redisPing === 'PONG';
  } catch {
    redisOk = false;
  }

  const storage = await getStorageStats().catch(() => null);
  const ok = dbOk && redisOk;

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    service: 'reelpath-api',
    uptimeSec: Math.round(process.uptime()),
    elapsedMs: Date.now() - startedAt,
    nodeEnv: cfg.NODE_ENV,
    mockExternalApis: cfg.MOCK_EXTERNAL_APIS,
    db: { ok: dbOk },
    redis: { ok: redisOk, ping: redisPing },
    storage,
  });
});

app.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});

app.get('/metrics', requireObservabilityAccess, async (_req, res) => {
  res.setHeader('Content-Type', client.register.contentType);
  res.send(await client.register.metrics());
});

app.use('/api/auth', authRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/videos', videosRouter);
app.use('/api/pipelines', pipelinesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/system', systemRouter);
app.use('/api/billing', billingRouter);
app.use('/api/org', orgRouter);
app.use('/api/platform', platformRouter);

installSentryErrorHandler(app);
app.use((err: Error & { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  Sentry.captureException(err);
  if (res.headersSent) return;
  const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
  res.status(status).json({ error: err.message });
});

// Red de seguridad: registra errores async huérfanos sin tumbar el servidor.
process.on('unhandledRejection', (reason) => {
  console.error('[api] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[api] uncaughtException:', err);
});

const port = config.API_PORT;

async function bootPlatformSecrets(): Promise<void> {
  try {
    const { imported } = await importPlatformSecretsFromEnvIfEmpty({
      YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
      YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      PEXELS_API_KEY: process.env.PEXELS_API_KEY,
    });
    if (imported.length > 0) {
      console.info(
        `[api] Secretos de plataforma importados desde .env legacy: ${imported.join(', ')}. ` +
          'Puedes quitar esas variables del .env; gestiona las keys en Ajustes → Secretos de plataforma.',
      );
    }
    await loadPlatformSecretsOverrides();
  } catch (err) {
    console.warn('[api] No se pudieron cargar secretos de plataforma:', err);
  }
}

void bootPlatformSecrets().then(() => {
  const server = app.listen(port, () => {
    console.log(`AutoTube API listening on :${port}`);
  });

  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`AutoTube API shutting down (${signal})...`);

    const forceExit = setTimeout(() => process.exit(1), 5000);
    forceExit.unref();

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect().catch(() => undefined);
    clearTimeout(forceExit);
    process.exit(0);
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
});

export { enqueuePipeline };
