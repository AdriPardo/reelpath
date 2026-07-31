import {
  decryptCredentialPayload,
  encryptCredentialPayload,
  loadConfig,
  resolvePlatformYouTubeOAuthAppSync,
} from '@autotube/config';
import { prisma } from '@autotube/database';
import { google } from 'googleapis';
import { hasYouTubeOAuthApp } from './youtube-oauth.js';
import { cacheDel, cacheGet, cacheSet } from './redis-cache.js';

const YT_INTEGRATION_CACHE_TTL_SEC = 10 * 60; // 10 min (rango 5–15 min acordado)

function ytIntegrationCacheKey(channelId: string): string {
  // v2: prefer platform OAuth client; no cachear status roto por clientId stale
  return `yt:integration:v2:${channelId}`;
}

export async function invalidateChannelIntegrationsCache(channelId: string): Promise<void> {
  await cacheDel(ytIntegrationCacheKey(channelId));
}

export type IntegrationProvider = 'youtube';

export interface YouTubeCredentialData {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  privacyStatus?: string;
  linkedFromEnv?: boolean;
}

export interface IntegrationProviderStatus {
  provider: IntegrationProvider;
  connected: boolean;
  tokenOk: boolean;
  source: 'channel' | 'env' | 'none';
  error: string | null;
  channelTitle?: string | null;
  privacyStatus?: string;
  /** Platform OAuth app configured (PlatformSecret / legacy env). */
  oauthAvailable?: boolean;
  /** Token includes yt-analytics.readonly scope. */
  analyticsOk?: boolean;
  analyticsError?: string | null;
}

export interface ChannelIntegrationsResponse {
  channelId: string;
  youtube: IntegrationProviderStatus;
}

function envYouTubeData(): YouTubeCredentialData | null {
  const config = loadConfig();
  const oauthApp = resolvePlatformYouTubeOAuthAppSync();
  if (!oauthApp || !config.YOUTUBE_REFRESH_TOKEN) {
    return null;
  }
  return {
    clientId: oauthApp.clientId,
    clientSecret: oauthApp.clientSecret,
    refreshToken: config.YOUTUBE_REFRESH_TOKEN,
    privacyStatus: config.YOUTUBE_PRIVACY_STATUS ?? 'private',
    linkedFromEnv: true,
  };
}

export function resolveYouTubeCredentials(
  stored: YouTubeCredentialData | null,
): { data: YouTubeCredentialData | null; source: 'channel' | 'env' | 'none' } {
  const config = loadConfig();
  const oauthApp = resolvePlatformYouTubeOAuthAppSync();

  if (stored?.refreshToken) {
    // Preferir app de plataforma: los tokens OAuth se emiten con ese Client ID.
    // Un clientId/secret stale en BD hace fallar el refresh (unauthorized_client).
    const clientId = oauthApp?.clientId ?? stored.clientId;
    const clientSecret = oauthApp?.clientSecret ?? stored.clientSecret;
    if (clientId && clientSecret) {
      return {
        data: {
          refreshToken: stored.refreshToken,
          clientId,
          clientSecret,
          privacyStatus: stored.privacyStatus ?? config.YOUTUBE_PRIVACY_STATUS ?? 'private',
          linkedFromEnv: false,
        },
        source: 'channel',
      };
    }
  }

  const env = envYouTubeData();
  if (env) return { data: env, source: 'env' };
  return { data: null, source: 'none' };
}

async function checkYouTubeStatus(
  creds: YouTubeCredentialData | null,
  source: 'channel' | 'env' | 'none',
): Promise<IntegrationProviderStatus> {
  const oauthAvailable = hasYouTubeOAuthApp();
  const base: IntegrationProviderStatus = {
    provider: 'youtube',
    connected: false,
    tokenOk: false,
    source,
    error: null,
    channelTitle: null,
    oauthAvailable,
  };

  if (!creds?.clientId || !creds.clientSecret || !creds.refreshToken) {
    return {
      ...base,
      error:
        source === 'env'
          ? null
          : oauthAvailable
            ? 'Conecta tu cuenta de YouTube para publicar en este canal'
            : 'YouTube no está disponible en la plataforma',
      privacyStatus: creds?.privacyStatus ?? loadConfig().YOUTUBE_PRIVACY_STATUS ?? 'private',
    };
  }

  try {
    const oauth2 = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
    oauth2.setCredentials({ refresh_token: creds.refreshToken });
    const { credentials } = await oauth2.refreshAccessToken();
    const tokenOk = !!credentials.access_token;

    let channelTitle: string | null = null;
    let listError: string | null = null;
    try {
      const youtube = google.youtube({ version: 'v3', auth: oauth2 });
      const channels = await youtube.channels.list({ part: ['snippet'], mine: true });
      channelTitle = channels.data.items?.[0]?.snippet?.title ?? null;
    } catch (err) {
      listError = err instanceof Error ? err.message : String(err);
    }

    let analyticsOk = false;
    let analyticsError: string | null = null;
    if (tokenOk) {
      try {
        const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: oauth2 });
        const end = new Date().toISOString().slice(0, 10);
        const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        await youtubeAnalytics.reports.query({
          ids: 'channel==MINE',
          startDate: start,
          endDate: end,
          metrics: 'views',
        });
        analyticsOk = true;
      } catch (err) {
        analyticsError = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      ...base,
      connected: true,
      tokenOk,
      channelTitle,
      // Solo marcar error de UI si el refresh falló; list/analytics son secundarios.
      error: tokenOk ? null : listError,
      privacyStatus: creds.privacyStatus ?? loadConfig().YOUTUBE_PRIVACY_STATUS ?? 'private',
      analyticsOk,
      analyticsError,
    };
  } catch (err) {
    return {
      ...base,
      connected: true,
      tokenOk: false,
      error: err instanceof Error ? err.message : String(err),
      privacyStatus: creds.privacyStatus ?? loadConfig().YOUTUBE_PRIVACY_STATUS ?? 'private',
    };
  }
}

export async function getChannelIntegrations(
  channelId: string,
): Promise<ChannelIntegrationsResponse> {
  const cacheKey = ytIntegrationCacheKey(channelId);
  const cached = await cacheGet<ChannelIntegrationsResponse>(cacheKey);
  if (cached) return cached;

  const stored = await prisma.integrationCredential.findMany({
    where: { channelId },
  });

  const youtubeStored = stored.find((c) => c.provider === 'youtube');
  const decrypted =
    (decryptCredentialPayload(youtubeStored?.data) as YouTubeCredentialData | null) ?? null;

  // Alinear clientId/secret con la app OAuth de plataforma (tokens emitidos por ella).
  const oauthApp = resolvePlatformYouTubeOAuthAppSync();
  if (
    youtubeStored &&
    decrypted?.refreshToken &&
    oauthApp &&
    (decrypted.clientId !== oauthApp.clientId || decrypted.clientSecret !== oauthApp.clientSecret)
  ) {
    await upsertChannelCredential(youtubeStored.organizationId, channelId, 'youtube', {
      clientId: oauthApp.clientId,
      clientSecret: oauthApp.clientSecret,
      refreshToken: decrypted.refreshToken,
      privacyStatus: decrypted.privacyStatus ?? loadConfig().YOUTUBE_PRIVACY_STATUS ?? 'private',
      linkedFromEnv: false,
    });
  }

  const youtubeResolved = resolveYouTubeCredentials(
    decrypted?.refreshToken
      ? {
          ...decrypted,
          ...(oauthApp
            ? { clientId: oauthApp.clientId, clientSecret: oauthApp.clientSecret }
            : {}),
        }
      : decrypted,
  );

  const youtube = await checkYouTubeStatus(youtubeResolved.data, youtubeResolved.source);
  const result = { channelId, youtube };

  // No cachear "needs attention": tras reconnect/heal debe verse al instante.
  if (youtube.tokenOk || !youtube.connected) {
    await cacheSet(cacheKey, result, YT_INTEGRATION_CACHE_TTL_SEC);
  }
  return result;
}

export type IntegrationSummary = Pick<
  IntegrationProviderStatus,
  'connected' | 'tokenOk' | 'source'
>;

export async function getIntegrationsSummaryForChannels(
  channelIds: string[],
): Promise<Record<string, { youtube: IntegrationSummary }>> {
  if (channelIds.length === 0) return {};

  const stored = await prisma.integrationCredential.findMany({
    where: { channelId: { in: channelIds } },
  });

  const byChannel: Record<string, typeof stored> = {};
  for (const cred of stored) {
    if (!cred.channelId) continue;
    if (!byChannel[cred.channelId]) byChannel[cred.channelId] = [];
    byChannel[cred.channelId].push(cred);
  }

  const result: Record<string, { youtube: IntegrationSummary }> = {};

  await Promise.all(
    channelIds.map(async (channelId) => {
      const cacheKey = ytIntegrationCacheKey(channelId);
      const cached = await cacheGet<ChannelIntegrationsResponse>(cacheKey);
      if (cached) {
        result[channelId] = {
          youtube: {
            connected: cached.youtube.connected,
            tokenOk: cached.youtube.tokenOk,
            source: cached.youtube.source,
          },
        };
        return;
      }

      const creds = byChannel[channelId] ?? [];
      const youtubeStored = creds.find((c) => c.provider === 'youtube');

      const youtubeResolved = resolveYouTubeCredentials(
        (decryptCredentialPayload(youtubeStored?.data) as YouTubeCredentialData | null) ?? null,
      );

      const youtubeFull = await checkYouTubeStatus(youtubeResolved.data, youtubeResolved.source);
      const response: ChannelIntegrationsResponse = { channelId, youtube: youtubeFull };

      result[channelId] = {
        youtube: {
          connected: youtubeFull.connected,
          tokenOk: youtubeFull.tokenOk,
          source: youtubeFull.source,
        },
      };
      await cacheSet(cacheKey, response, YT_INTEGRATION_CACHE_TTL_SEC);
    }),
  );

  return result;
}

export async function upsertChannelCredential(
  organizationId: string,
  channelId: string,
  provider: IntegrationProvider,
  data: YouTubeCredentialData,
): Promise<void> {
  const existing = await prisma.integrationCredential.findFirst({
    where: { channelId, provider },
  });

  if (existing) {
    await prisma.integrationCredential.update({
      where: { id: existing.id },
      data: { data: encryptCredentialPayload(data as Record<string, unknown>) as object },
    });
    await invalidateChannelIntegrationsCache(channelId);
    return;
  }

  await prisma.integrationCredential.create({
    data: {
      organizationId,
      channelId,
      provider,
      data: encryptCredentialPayload(data as Record<string, unknown>) as object,
    },
  });
  await invalidateChannelIntegrationsCache(channelId);
}

export async function deleteChannelCredential(
  channelId: string,
  provider: IntegrationProvider,
): Promise<void> {
  await prisma.integrationCredential.deleteMany({
    where: { channelId, provider },
  });
  await invalidateChannelIntegrationsCache(channelId);
}

export function buildCredentialFromEnv(provider: IntegrationProvider) {
  if (provider === 'youtube') {
    const env = envYouTubeData();
    if (!env) throw new Error('No hay credenciales YouTube globales en .env');
    return env;
  }
  throw new Error('Proveedor no soportado');
}
