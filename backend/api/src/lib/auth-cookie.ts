import type { Response } from 'express';
import { loadConfig } from '@autotube/config';

export const AUTH_COOKIE_NAME = 'reelpath_token';
export const LEGACY_AUTH_COOKIE_NAME = 'autotube_token';
export const AUTH_COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60;

function cookieSecure(): boolean {
  const config = loadConfig();
  return config.NODE_ENV === 'production' || config.FRONTEND_URL.startsWith('https://');
}

function serializeAuthCookie(name: string, value: string, maxAge: number): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (cookieSecure()) parts.push('Secure');
  return parts.join('; ');
}

/** Cookie de sesión HttpOnly (no accesible desde JS). */
export function setAuthCookies(res: Response, token: string): void {
  const maxAge = AUTH_COOKIE_MAX_AGE_SEC;
  res.append('Set-Cookie', serializeAuthCookie(AUTH_COOKIE_NAME, token, maxAge));
  res.append('Set-Cookie', serializeAuthCookie(LEGACY_AUTH_COOKIE_NAME, token, maxAge));
}

export function clearAuthCookies(res: Response): void {
  res.append('Set-Cookie', serializeAuthCookie(AUTH_COOKIE_NAME, '', 0));
  res.append('Set-Cookie', serializeAuthCookie(LEGACY_AUTH_COOKIE_NAME, '', 0));
}
