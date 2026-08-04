import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { isCrossSiteCookie, setAuthCookies, AUTH_COOKIE_NAME } from './auth-cookie.js';

function mockRes() {
  const cookies: string[] = [];
  return {
    cookies,
    append(name: string, value: string) {
      if (name === 'Set-Cookie') cookies.push(value);
    },
  } as unknown as Response & { cookies: string[] };
}

describe('auth-cookie', () => {
  it('same hostname different ports is not cross-site', () => {
    const req = {
      headers: { host: 'localhost:4000', origin: 'http://localhost:3000' },
    } as unknown as Request;
    expect(isCrossSiteCookie(req)).toBe(false);
  });

  it('same host reverse proxy is not cross-site', () => {
    const req = {
      headers: { host: 'app.example.com', origin: 'https://app.example.com' },
    } as unknown as Request;
    expect(isCrossSiteCookie(req)).toBe(false);
  });

  it('split frontend/API hosts are cross-site', () => {
    const req = {
      headers: { host: 'api.example.com', origin: 'https://app.example.com' },
    } as unknown as Request;
    expect(isCrossSiteCookie(req)).toBe(true);
  });

  it('setAuthCookies uses SameSite=None when cross-site', () => {
    const res = mockRes();
    const req = {
      headers: { host: 'api.example.com', origin: 'https://app.example.com' },
    } as unknown as Request;
    setAuthCookies(res, 'tok.en.value', req);
    expect(res.cookies.length).toBeGreaterThanOrEqual(1);
    expect(res.cookies[0]).toMatch(/SameSite=None/);
    expect(res.cookies[0]).toMatch(/Secure/);
    expect(res.cookies[0]).toMatch(new RegExp(`^${AUTH_COOKIE_NAME}=`));
  });

  it('setAuthCookies uses SameSite=Lax on same-site', () => {
    const res = mockRes();
    const req = {
      headers: { host: 'app.example.com', origin: 'https://app.example.com' },
    } as unknown as Request;
    setAuthCookies(res, 'tok.en.value', req);
    expect(res.cookies[0]).toMatch(/SameSite=Lax/);
  });
});
