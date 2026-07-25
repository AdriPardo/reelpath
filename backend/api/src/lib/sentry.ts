import * as Sentry from '@sentry/node';
import type express from 'express';
import { loadConfig } from '@autotube/config';

export function initSentryForApi(): void {
  const cfg = loadConfig();
  if (!cfg.SENTRY_DSN) return;

  Sentry.init({
    dsn: cfg.SENTRY_DSN,
    environment: cfg.SENTRY_ENVIRONMENT ?? cfg.NODE_ENV,
    tracesSampleRate: 0,
  });
}

export function installSentryMiddleware(app: express.Express): void {
  // Sentry v8/v9 compatibility: keep optional + no-op when DSN missing.
  const cfg = loadConfig();
  if (!cfg.SENTRY_DSN) return;

  const anySentry = Sentry as unknown as {
    setupExpressErrorHandler?: (app: express.Express) => void;
    Handlers?: {
      requestHandler?: () => express.RequestHandler;
    };
  };

  if (anySentry.Handlers?.requestHandler) {
    app.use(anySentry.Handlers.requestHandler());
  }
}

export function installSentryErrorHandler(app: express.Express): void {
  const cfg = loadConfig();
  if (!cfg.SENTRY_DSN) return;

  const anySentry = Sentry as unknown as {
    setupExpressErrorHandler?: (app: express.Express) => void;
  };

  if (anySentry.setupExpressErrorHandler) {
    anySentry.setupExpressErrorHandler(app);
  }
}

export { Sentry };

