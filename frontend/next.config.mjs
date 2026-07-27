/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sentryEnabled = Boolean(process.env.SENTRY_DSN);

const nextConfig = {
  devIndicators: false,
  // Required for Docker image (Dockerfile.frontend copies .next/standalone).
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..'),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_AUTH_REQUIRED: process.env.NEXT_PUBLIC_AUTH_REQUIRED ?? 'false',
  },
  webpack: (config) => {
    if (!sentryEnabled) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@sentry/nextjs': false,
      };
    }
    return config;
  },
  async redirects() {
    return [
      { source: '/privacy', destination: '/privacy-policy', permanent: true },
      { source: '/terms', destination: '/terms-of-service', permanent: true },
      { source: '/landing', destination: '/', permanent: true },
    ];
  },
};

const withSentry = sentryEnabled && process.env.SENTRY_AUTH_TOKEN ? withSentryConfig : (config) => config;

export default withNextIntl(
  withSentry(nextConfig, {
    silent: true,
  }),
);
