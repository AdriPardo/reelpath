import 'dotenv/config';
import { createPipelineWorker } from '@autotube/job-queue';
import { processPipelineJob } from './pipeline.js';
import { captureWorkerError, initSentryForWorker, Sentry } from './sentry.js';

initSentryForWorker();

const worker = createPipelineWorker(async (job) => {
  console.log(`[worker] Processing step: ${job.data.step ?? job.name} run=${job.data.pipelineRunId}`);
  await processPipelineJob(job);
  console.log(`[worker] Completed step: ${job.data.step ?? job.name}`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job failed: ${job?.id}`, err.message);
  captureWorkerError(err, job ?? undefined);
});

worker.on('ready', () => {
  console.log('[worker] AutoTube pipeline worker ready');
  void (async () => {
    try {
      const {
        importPlatformSecretsFromEnvIfEmpty,
        loadPlatformSecretsOverrides,
      } = await import('@autotube/database');
      await importPlatformSecretsFromEnvIfEmpty({
        YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
        YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
        PEXELS_API_KEY: process.env.PEXELS_API_KEY,
      });
      await loadPlatformSecretsOverrides();
    } catch (err) {
      console.warn('[worker] No se pudieron cargar secretos de plataforma:', err);
    }
  })();
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] Shutting down (${signal})...`);

  const forceExit = setTimeout(() => process.exit(1), 5000);
  forceExit.unref();

  await worker.close(true);
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[worker] unhandledRejection:', reason);
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
});
process.on('uncaughtException', (err) => {
  console.error('[worker] uncaughtException:', err);
  Sentry.captureException(err);
});
