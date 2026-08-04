import { NextRequest } from 'next/server';
import { decodeAuthCookieValue } from '@/lib/auth-cookie-utils';
import { AUTH_COOKIE } from '@/lib/auth-constants';

const API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const token = decodeAuthCookieValue(request.cookies.get(AUTH_COOKIE)?.value);
  const search = request.nextUrl.search;
  const targetUrl = `${API_URL}/api/${path.join('/')}${search}`;

  const headers = new Headers();
  const range = request.headers.get('range');
  if (range) headers.set('range', range);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const upstream = await fetch(targetUrl, { headers, cache: 'no-store' });

  const responseHeaders = new Headers();
  const passThrough = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
  for (const key of passThrough) {
    const value = upstream.headers.get(key);
    if (value) responseHeaders.set(key, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
