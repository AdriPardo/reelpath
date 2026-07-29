import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { loadConfig } from '@autotube/config';

export type MemberRole = 'owner' | 'admin' | 'member';

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: MemberRole;
  email: string;
}

export interface JwtPayload extends AuthContext {
  sub: string;
}

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

const INSECURE_DEV_SECRET = 'dev-insecure-auth-secret-change-me';

export function getAuthSecretKey(): Uint8Array {
  const config = loadConfig();
  const secret = config.AUTH_SECRET?.trim();
  if (!secret) {
    if (config.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET es obligatorio en producción');
    }
    return new TextEncoder().encode(INSECURE_DEV_SECRET);
  }
  if (secret === INSECURE_DEV_SECRET && config.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET inseguro no permitido en producción');
  }
  if (secret.length < 32 && (config.NODE_ENV === 'production' || config.AUTH_REQUIRED)) {
    throw new Error('AUTH_SECRET debe tener al menos 32 caracteres');
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: AuthContext): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    organizationId: payload.organizationId,
    role: payload.role,
    email: payload.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getAuthSecretKey());
}

export async function verifyToken(token: string): Promise<AuthContext | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    const userId = payload.userId ?? payload.sub;
    const organizationId = payload.organizationId;
    const role = payload.role;
    const email = payload.email;
    if (
      typeof userId !== 'string' ||
      typeof organizationId !== 'string' ||
      typeof role !== 'string' ||
      typeof email !== 'string'
    ) {
      return null;
    }
    if (!['owner', 'admin', 'member'].includes(role)) return null;
    return {
      userId,
      organizationId,
      role: role as MemberRole,
      email,
    };
  } catch {
    return null;
  }
}

export function isAdminRole(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin';
}
