import { AUTH_COOKIE, LEGACY_AUTH_COOKIE } from './auth-constants';

const TOKEN_KEY = AUTH_COOKIE;
const LEGACY_TOKEN_KEY = LEGACY_AUTH_COOKIE;

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY);
}

export function getToken(): string | null {
  return readStoredToken();
}

function writeAuthCookie(name: string, value: string, maxAgeSeconds: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  const maxAge = 7 * 24 * 60 * 60;
  writeAuthCookie(AUTH_COOKIE, token, maxAge);
  writeAuthCookie(LEGACY_AUTH_COOKIE, token, maxAge);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  writeAuthCookie(AUTH_COOKIE, '', 0);
  writeAuthCookie(LEGACY_AUTH_COOKIE, '', 0);
}

export function isAuthRequired(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_REQUIRED === 'true';
}
