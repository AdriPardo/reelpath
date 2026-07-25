const sentryEnabled = Boolean(process.env.SENTRY_DSN);

export async function register() {
  if (!sentryEnabled) return;

  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
  },
) {
  if (!sentryEnabled) return;

  const Sentry = await import('@sentry/nextjs');
  return Sentry.captureRequestError(err, request, context);
}
