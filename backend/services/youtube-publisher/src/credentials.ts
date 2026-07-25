import { decryptCredentialPayload, loadConfig } from '@autotube/config';
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
 * Per-channel refresh tokens are stored in IntegrationCredential; client id/secret come from platform env.
 * Falls back to global YOUTUBE_REFRESH_TOKEN in .env only when the channel has no stored credential (dev convenience).
 */
export async function resolveYouTubeCredentialsForChannel(
  channelId: string,
): Promise<ResolvedYouTubeCredentials | null> {
  const config = loadConfig();

  const stored = await prisma.integrationCredential.findFirst({
    where: { channelId, provider: 'youtube' },
  });
  const data = (decryptCredentialPayload(stored?.data) as YouTubeCredentialData | null) ?? null;

  if (data?.refreshToken) {
    const clientId = data.clientId ?? config.YOUTUBE_CLIENT_ID;
    const clientSecret = data.clientSecret ?? config.YOUTUBE_CLIENT_SECRET;
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

  if (config.YOUTUBE_CLIENT_ID && config.YOUTUBE_CLIENT_SECRET && config.YOUTUBE_REFRESH_TOKEN) {
    return {
      clientId: config.YOUTUBE_CLIENT_ID,
      clientSecret: config.YOUTUBE_CLIENT_SECRET,
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
