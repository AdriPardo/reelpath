import es from '../messages/es.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };

export type ApiLocale = 'es' | 'en';

type MessageTree = Record<string, unknown>;

const catalogs: Record<ApiLocale, MessageTree> = { es, en };

function parseAcceptLanguage(header: string | undefined): ApiLocale {
  if (!header) return 'es';
  const parts = header.split(',').map((p) => p.trim().split(';')[0]?.toLowerCase());
  for (const part of parts) {
    if (part?.startsWith('en')) return 'en';
    if (part?.startsWith('es')) return 'es';
  }
  return 'es';
}

export function resolveLocale(options?: {
  queryLocale?: string | string[] | undefined;
  acceptLanguage?: string | undefined;
  userLocale?: string | null | undefined;
}): ApiLocale {
  const rawQuery = options?.queryLocale;
  const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
  if (query === 'en' || query === 'es') return query;
  if (options?.userLocale === 'en' || options?.userLocale === 'es') return options.userLocale;
  return parseAcceptLanguage(options?.acceptLanguage);
}

function resolveKey(tree: MessageTree, key: string): string | undefined {
  const parts = key.split('.');
  let node: unknown = tree;
  for (const part of parts) {
    if (!node || typeof node !== 'object' || !(part in (node as MessageTree))) return undefined;
    node = (node as MessageTree)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

/** Traduce claves de error/mensaje user-facing del API. */
export function t(
  locale: ApiLocale | string,
  key: string,
  params?: Record<string, string | number>,
): string {
  const loc = (locale === 'en' ? 'en' : 'es') as ApiLocale;
  const raw = resolveKey(catalogs[loc], key) ?? resolveKey(catalogs.es, key);
  if (!raw) return key;
  return interpolate(raw, params);
}
