import es from '../../messages/es.json';
import en from '../../messages/en.json';
import { routing, type AppLocale } from '@/i18n/routing';

export type { AppLocale };
export const defaultLocale = routing.defaultLocale;

type MessageTree = Record<string, unknown>;

const catalogs: Record<AppLocale, MessageTree> = { es, en };

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

/** Traducción para código fuera de React (libs, utilidades). */
export function translate(
  locale: AppLocale | string,
  key: string,
  params?: Record<string, string | number>,
): string {
  const loc = (locale === 'en' ? 'en' : 'es') as AppLocale;
  const raw = resolveKey(catalogs[loc], key) ?? resolveKey(catalogs.es, key);
  if (!raw) return key;
  return interpolate(raw, params);
}

export function getMessageCatalog(locale: AppLocale | string): MessageTree {
  const loc = (locale === 'en' ? 'en' : 'es') as AppLocale;
  return catalogs[loc];
}
