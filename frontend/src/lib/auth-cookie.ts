import { cookies } from 'next/headers';
import { decodeAuthCookieValue } from './auth-cookie-utils';
import { AUTH_COOKIE, LEGACY_AUTH_COOKIE } from './auth-constants';

export async function getServerAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return (
    decodeAuthCookieValue(cookieStore.get(AUTH_COOKIE)?.value) ??
    decodeAuthCookieValue(cookieStore.get(LEGACY_AUTH_COOKIE)?.value)
  );
}

export async function authHeadersFromCookie(): Promise<Record<string, string>> {
  const token = await getServerAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
