import type { Request } from 'express';
import { resolveLocale, type ApiLocale } from './i18n.js';

export function localeFromRequest(req: Request): ApiLocale {
  const query = req.query.locale;
  const acceptLanguage = req.headers['accept-language'];
  return resolveLocale({
    queryLocale: typeof query === 'string' ? query : undefined,
    acceptLanguage: typeof acceptLanguage === 'string' ? acceptLanguage : undefined,
    userLocale: req.userLocale,
  });
}
