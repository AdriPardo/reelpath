import * as Sentry from '@sentry/node';
import type { Job } from 'bullmq';
import { loadConfig } from '@autotube/config';

export function initSentryForWorker(): void {
  const cfg = loadConfig();
  if (!cfg.SENTRY_DSN) return;

  Sentry.init({
    dsn: cfg.SENTRY_DSN,
    environment: cfg.SENTRY_ENVIRONMENT ?? cfg.NODE_ENV,
    tracesSampleRate: 0,
  });
}

export function captureWorkerError(err: unknown, job?: Job | null, extra?: Record<string, unknown>): void {
  const cfg = loadConfig();
  if (!cfg.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (job) {
      scope.setTag('bullmq.queue', job.queueName);
      scope.setTag('bullmq.jobName', job.name);
      scope.setExtra('bullmq.jobId', job.id);
      scope.setExtra('bullmq.data', job.data as unknown);
    }
    if (extra) scope.setExtras(extra);
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
  });
}

export { Sentry };

