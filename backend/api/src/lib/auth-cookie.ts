import type { Request, Response } from 'express';

export const AUTH_COOKIE_NAME = 'reelpath_token';
export const LEGACY_AUTH_COOKIE_NAME = 'autotube_token';
export const AUTH_COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60;

function cookieSecure(): boolean {
  const frontendUrl = process.env.FRONTEND_URL || '';
  return process.env.NODE_ENV === 'production' || frontendUrl.startsWith('https://');
}

/**
 * Cross-site cookie jar: Origin host ≠ API Host (ports ignored).
 * Same host different ports (localhost:3000 → :4000) stays SameSite=Lax.
 */
export function isCrossSiteCookie(req?: Request): boolean {
  const origin = req?.headers.origin;
  const requestHost = req?.headers.host?.split(':')[0]?.toLowerCase();
  if (!origin || !requestHost) return false;
  try {
    const originHost = new URL(origin).hostname.toLowerCase();
    return originHost !== requestHost;
  } catch {
    return false;
  }
}

function serializeAuthCookie(
  name: string,
  value: string,
  maxAge: number,
  opts: { secure: boolean; sameSite: 'Lax' | 'None' },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    `SameSite=${opts.sameSite}`,
  ];
  if (opts.secure || opts.sameSite === 'None') parts.push('Secure');
  return parts.join('; ');
}

function cookieOptions(req?: Request): { secure: boolean; sameSite: 'Lax' | 'None' } {
  const crossSite = isCrossSiteCookie(req);
  return {
    secure: cookieSecure() || crossSite,
    sameSite: crossSite ? 'None' : 'Lax',
  };
}

/** Cookie de sesión HttpOnly (no accesible desde JS). */
export function setAuthCookies(res: Response, token: string, req?: Request): void {
  const maxAge = AUTH_COOKIE_MAX_AGE_SEC;
  const opts = cookieOptions(req);
  res.append('Set-Cookie', serializeAuthCookie(AUTH_COOKIE_NAME, token, maxAge, opts));
  res.append('Set-Cookie', serializeAuthCookie(LEGACY_AUTH_COOKIE_NAME, token, maxAge, opts));
}

export function clearAuthCookies(res: Response, req?: Request): void {
  const opts = cookieOptions(req);
  res.append('Set-Cookie', serializeAuthCookie(AUTH_COOKIE_NAME, '', 0, opts));
  res.append('Set-Cookie', serializeAuthCookie(LEGACY_AUTH_COOKIE_NAME, '', 0, opts));
}
