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

export async function onRouterTransitionStart(
  href: string,
  navigationType: 'push' | 'replace' | 'traverse',
) {
  if (!sentryEnabled) return;

  const Sentry = await import('@sentry/nextjs');
  return Sentry.captureRouterTransitionStart(href, navigationType);
}
