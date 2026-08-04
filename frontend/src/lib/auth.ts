import { AUTH_COOKIE, LEGACY_AUTH_COOKIE } from './auth-constants';

const TOKEN_KEY = AUTH_COOKIE;
const LEGACY_TOKEN_KEY = LEGACY_AUTH_COOKIE;

/**
 * Sesión vive en cookie HttpOnly del API (Set-Cookie).
 * localStorage ya no guarda el JWT (mitiga robo vía XSS).
 * getToken solo sirve legado / e2e Bearer opcional.
 */
function readLegacyStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY);
}

export function getToken(): string | null {
  return readLegacyStoredToken();
}

/**
 * Solo limpia copias legacy no-HttpOnly. Nunca llamar tras login:
 * en WebKit móvil, `document.cookie` con el mismo nombre que la HttpOnly
 * puede sombrear la sesión y la app parece deslogueada.
 */
function expireLegacyClientCookie(name: string): void {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${secure}`;
}

/** Tras login/register: limpia JWT en localStorage; la cookie HttpOnly la pone el API. */
export function setToken(_token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  expireLegacyClientCookie(AUTH_COOKIE);
  expireLegacyClientCookie(LEGACY_AUTH_COOKIE);
}

export function isAuthRequired(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_REQUIRED === 'true';
}
