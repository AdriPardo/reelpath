import { loadConfig } from '@autotube/config';
import { google } from 'googleapis';
import type { ResolvedYouTubeCredentials } from './credentials.js';

export function hasYouTubeCredentials(): boolean {
  const config = loadConfig();
  return !!(
    config.YOUTUBE_CLIENT_ID &&
    config.YOUTUBE_CLIENT_SECRET &&
    config.YOUTUBE_REFRESH_TOKEN
  );
}

export function createYouTubeOAuthFromCredentials(creds: ResolvedYouTubeCredentials) {
  const oauth2 = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
  oauth2.setCredentials({ refresh_token: creds.refreshToken });
  return oauth2;
}

/** @deprecated Prefer createYouTubeOAuthFromCredentials with per-channel credentials. */
export function createYouTubeOAuth() {
  const config = loadConfig();
  if (!hasYouTubeCredentials()) {
    throw new Error(
      'YouTube OAuth incompleto — conecta YouTube en Integraciones del canal o configura credenciales de desarrollo',
    );
  }

  return createYouTubeOAuthFromCredentials({
    clientId: config.YOUTUBE_CLIENT_ID!,
    clientSecret: config.YOUTUBE_CLIENT_SECRET!,
    refreshToken: config.YOUTUBE_REFRESH_TOKEN!,
    privacyStatus: config.YOUTUBE_PRIVACY_STATUS ?? 'private',
    source: 'env',
  });
}

export function canUseRealYouTube(): boolean {
  const config = loadConfig();
  return !config.MOCK_EXTERNAL_APIS && hasYouTubeCredentials();
}

const YOUTUBE_AUTH_ERROR =
  /invalid_grant|refresh token is invalid|token has been expired/i;

/** Maps Google OAuth refresh failures to a clear, actionable message. */
export function formatYouTubeAuthError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (YOUTUBE_AUTH_ERROR.test(msg)) {
    return new Error(
      'La sesión con YouTube ha caducado o fue revocada. Ve a Integraciones de tu canal y conecta YouTube de nuevo.',
    );
  }
  return err instanceof Error ? err : new Error(msg);
}
