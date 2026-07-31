import { decryptCredentialPayload, loadConfig, resolvePlatformYouTubeOAuthAppSync } from '@autotube/config';
import { prisma } from '@autotube/database';

export interface YouTubeCredentialData {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: string;
  privacyStatus?: string;
  linkedFromEnv?: boolean;
}

export interface ResolvedYouTubeCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  source: 'channel' | 'env';
}

/**
 * Loads YouTube OAuth credentials for a channel.
 * Per-channel refresh tokens are stored in IntegrationCredential;
 * client id/secret come from PlatformSecret (gestor de secretos), with legacy env fallback.
 */
export async function resolveYouTubeCredentialsForChannel(
  channelId: string,
): Promise<ResolvedYouTubeCredentials | null> {
  const config = loadConfig();
  const oauthApp = resolvePlatformYouTubeOAuthAppSync();

  const stored = await prisma.integrationCredential.findFirst({
    where: { channelId, provider: 'youtube' },
  });
  const data = (decryptCredentialPayload(stored?.data) as YouTubeCredentialData | null) ?? null;

  if (data?.refreshToken) {
    // Prefer platform OAuth app — channel refresh tokens are issued by that client.
    const clientId = oauthApp?.clientId ?? data.clientId;
    const clientSecret = oauthApp?.clientSecret ?? data.clientSecret;
    if (!clientId || !clientSecret) return null;
    return {
      clientId,
      clientSecret,
      refreshToken: data.refreshToken,
      privacyStatus: (data.privacyStatus ??
        config.YOUTUBE_PRIVACY_STATUS ??
        'private') as ResolvedYouTubeCredentials['privacyStatus'],
      source: 'channel',
    };
  }

  if (oauthApp && config.YOUTUBE_REFRESH_TOKEN) {
    return {
      clientId: oauthApp.clientId,
      clientSecret: oauthApp.clientSecret,
      refreshToken: config.YOUTUBE_REFRESH_TOKEN,
      privacyStatus: config.YOUTUBE_PRIVACY_STATUS ?? 'private',
      source: 'env',
    };
  }

  return null;
}

export async function hasYouTubeCredentialsForChannel(channelId: string): Promise<boolean> {
  const creds = await resolveYouTubeCredentialsForChannel(channelId);
  return creds !== null;
}
