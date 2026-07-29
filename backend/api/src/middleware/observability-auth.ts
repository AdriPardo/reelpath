import type { NextFunction, Request, Response } from 'express';
import { loadConfig } from '@autotube/config';
import { isAdminRole, verifyToken } from '../lib/auth.js';

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

function extractCookieToken(req: Request): string | null {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const match =
    cookie.match(/(?:^|;\s*)reelpath_token=([^;]+)/) ??
    cookie.match(/(?:^|;\s*)autotube_token=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * /metrics y /health/extended: token de métricas o sesión admin.
 * Sin METRICS_BEARER_TOKEN en producción → denegado (salvo admin autenticado).
 */
export async function requireObservabilityAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const metricsToken = process.env.METRICS_BEARER_TOKEN?.trim();
  const bearer = extractBearer(req);

  if (metricsToken && bearer && bearer === metricsToken) {
    next();
    return;
  }

  const token = bearer ?? extractCookieToken(req);
  if (token) {
    const auth = await verifyToken(token);
    if (auth && isAdminRole(auth.role)) {
      next();
      return;
    }
  }

  const config = loadConfig();
  if (config.NODE_ENV !== 'production' && !metricsToken) {
    // Dev sin token configurado: permitir solo loopback.
    const ip = req.ip || req.socket.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      next();
      return;
    }
  }

  res.status(401).json({ error: 'Autenticación de observabilidad requerida' });
}
