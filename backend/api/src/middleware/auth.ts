import type { NextFunction, Request, Response } from 'express';
import { isPlatformAdminEmail } from '@autotube/config';
import { prisma } from '@autotube/database';
import { isAdminRole, verifyToken, type AuthContext } from '../lib/auth.js';
import type { ApiLocale } from '../lib/i18n.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext | null;
      userLocale?: ApiLocale | null;
    }
  }
}

function extractBearerToken(req: Request): string | null {
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

function extractAuthToken(req: Request): string | null {
  return extractBearerToken(req) ?? extractCookieToken(req);
}

export async function parseAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractAuthToken(req);

  if (token) {
    req.auth = await verifyToken(token);
  } else {
    req.auth = null;
  }

  next();
}

async function attachUserLocale(req: Request): Promise<void> {
  if (!req.auth) {
    req.userLocale = null;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { locale: true },
  });
  req.userLocale = user?.locale === 'en' ? 'en' : 'es';
}

export async function attachUserLocaleMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await attachUserLocale(req);
  } catch {
    req.userLocale = null;
  }
  next();
}

/**
 * Fail-closed: las rutas bajo authMiddleware exigen sesión válida.
 * AUTH_REQUIRED solo controla UI/registro público; la API no se abre sin auth.
 */
export function enforceAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Autenticación requerida' });
    return;
  }

  next();
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  await parseAuthMiddleware(req, res, (err) => {
    if (err) {
      next(err);
      return;
    }
    void attachUserLocaleMiddleware(req, res, () => {
      enforceAuthMiddleware(req, res, next);
    });
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Autenticación requerida' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth || !isAdminRole(req.auth.role)) {
    res.status(403).json({ error: 'Se requiere rol de administrador' });
    return;
  }
  next();
}

/** Solo propietario de la organización. */
export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth || req.auth.role !== 'owner') {
    res.status(403).json({ error: 'Se requiere rol de propietario' });
    return;
  }
  next();
}

/** Operador de plataforma (PLATFORM_ADMIN_EMAILS), no confundir con admin de org. */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth || !isPlatformAdminEmail(req.auth.email)) {
    res.status(403).json({ error: 'Se requiere acceso de administrador de plataforma' });
    return;
  }
  next();
}

export function orgScope(req: Request): string | undefined {
  return req.auth?.organizationId;
}

export async function orgChannelIds(req: Request): Promise<string[] | null> {
  const orgId = orgScope(req);
  if (!orgId) return null;
  const { getOrgChannelIds } = await import('../lib/tenant.js');
  return getOrgChannelIds(orgId);
}
