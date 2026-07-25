import { routing } from '@/i18n/routing';

export const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/invite',
  '/landing',
  '/privacy-policy',
  '/terms-of-service',
  '/privacy',
  '/terms',
  '/ayuda',
];

/** Quita el prefijo /es o /en de un pathname. */
export function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1) || '/';
    }
  }
  return pathname;
}

export function isPublicPath(pathname: string): boolean {
  const path = stripLocalePrefix(pathname);
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
