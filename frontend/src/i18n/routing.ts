import { defineRouting } from 'next-intl/routing';

export const locales = ['es', 'en'] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale: 'es',
  localePrefix: 'always',
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
  },
});
