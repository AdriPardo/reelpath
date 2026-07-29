import { loadConfig, resolvePlatformYouTubeOAuthAppSync } from '@autotube/config';
import { SignJWT, jwtVerify } from 'jose';
import { google } from 'googleapis';

export const YOUTUBE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

export interface YouTubeOAuthState {
  channelId: string;
  organizationId: string;
}

function getSecretKey(): Uint8Array {
  const config = loadConfig();
  const secret = config.AUTH_SECRET ?? 'dev-insecure-auth-secret-change-me';
  return new TextEncoder().encode(secret);
}

/** Redirect URI registered in Google Cloud (single fixed path; channel id travels in state). */
export function getYouTubeOAuthRedirectUri(): string {
  const config = loadConfig();
  if (process.env.YOUTUBE_OAUTH_REDIRECT_URI) {
    return process.env.YOUTUBE_OAUTH_REDIRECT_URI;
  }
  if (process.env.DOMAIN?.trim()) {
    const domain = process.env.DOMAIN.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${domain}/api/integrations/youtube/callback`;
  }
  return `http://localhost:${config.API_PORT}/api/integrations/youtube/callback`;
}

export function hasYouTubeOAuthApp(): boolean {
  return resolvePlatformYouTubeOAuthAppSync() !== null;
}

export function createYouTubeOAuth2Client() {
  const app = resolvePlatformYouTubeOAuthAppSync();
  if (!app) {
    throw new Error(
      'YouTube OAuth no configurado. Añade Client ID y Secret en Ajustes → Secretos de plataforma.',
    );
  }
  return new google.auth.OAuth2(app.clientId, app.clientSecret, getYouTubeOAuthRedirectUri());
}

export async function signYouTubeOAuthState(payload: YouTubeOAuthState): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getSecretKey());
}

export async function verifyYouTubeOAuthState(state: string): Promise<YouTubeOAuthState | null> {
  try {
    const { payload } = await jwtVerify(state, getSecretKey());
    const channelId = payload.channelId;
    const organizationId = payload.organizationId;
    if (typeof channelId !== 'string' || typeof organizationId !== 'string') {
      return null;
    }
    return { channelId, organizationId };
  } catch {
    return null;
  }
}

export function buildYouTubeAuthUrl(state: string): string {
  const oauth2 = createYouTubeOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: YOUTUBE_OAUTH_SCOPES,
    state,
  });
}

export async function exchangeYouTubeAuthCode(code: string): Promise<{
  refreshToken: string;
  accessToken?: string;
  expiresAt?: Date;
}> {
  const oauth2 = createYouTubeOAuth2Client();
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      'Google no devolvió un refresh token. Revoca el acceso en tu cuenta de Google e inténtalo de nuevo.',
    );
  }

  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token ?? undefined,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
  };
}
