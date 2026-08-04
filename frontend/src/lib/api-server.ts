import { getServerSideApiUrl } from './api-url';
import { authHeadersFromCookie } from './auth-cookie';

export class ServerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ServerApiError';
  }
}

export async function serverApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getServerSideApiUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeadersFromCookie()),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new ServerApiError(await res.text(), res.status);
  return res.json() as Promise<T>;
}
