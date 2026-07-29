import { Router } from 'express';
import { decryptCredentialPayload, loadConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import { google } from 'googleapis';
import {
  type YouTubeCredentialData,
  upsertChannelCredential,
  invalidateChannelIntegrationsCache,
} from '../lib/channel-integrations.js';
import {
  exchangeYouTubeAuthCode,
  verifyYouTubeOAuthState,
} from '../lib/youtube-oauth.js';
import { authMiddleware, orgScope } from '../middleware/auth.js';

export const integrationsRouter = Router();

/** Google OAuth redirect — no JWT; channel id is carried in signed state. */
integrationsRouter.get('/youtube/callback', async (req, res) => {
  const config = loadConfig();
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const state = typeof req.query.state === 'string' ? req.query.state : null;
  const oauthError = typeof req.query.error === 'string' ? req.query.error : null;

  const payload = state ? await verifyYouTubeOAuthState(state) : null;
  const channelId = payload?.channelId ?? '';
  const redirectBase = channelId
    ? `${config.FRONTEND_URL}/channels/${channelId}?tab=integraciones`
    : `${config.FRONTEND_URL}/?youtube=error`;

  if (oauthError) {
    return res.redirect(`${redirectBase}&youtube=error&message=${encodeURIComponent(oauthError)}`);
  }

  if (!code || !payload) {
    return res.redirect(
      `${redirectBase}&youtube=error&message=${encodeURIComponent('Sesión OAuth inválida o incompleta')}`,
    );
  }

  try {
    const tokens = await exchangeYouTubeAuthCode(code);
    const channel = await prisma.channel.findUnique({
      where: { id: payload.channelId },
      select: { id: true, organizationId: true },
    });
    if (!channel || channel.organizationId !== payload.organizationId) {
      return res.redirect(
        `${redirectBase}&youtube=error&message=${encodeURIComponent('Canal no pertenece a la organización del state OAuth')}`,
      );
    }

    const existing = await prisma.integrationCredential.findFirst({
      where: { channelId: payload.channelId, provider: 'youtube' },
    });
    const current = (decryptCredentialPayload(existing?.data) as YouTubeCredentialData) ?? {};

    await upsertChannelCredential(payload.organizationId, payload.channelId, 'youtube', {
      ...current,
      refreshToken: tokens.refreshToken,
      privacyStatus: current.privacyStatus ?? config.YOUTUBE_PRIVACY_STATUS ?? 'private',
      linkedFromEnv: false,
    });

    await invalidateChannelIntegrationsCache(payload.channelId);

    return res.redirect(`${redirectBase}&youtube=connected`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.redirect(`${redirectBase}&youtube=error&message=${encodeURIComponent(message)}`);
  }
});

integrationsRouter.use(authMiddleware);

integrationsRouter.get('/youtube/status', async (req, res) => {
  const orgId = orgScope(req);
  const config = loadConfig();
  const { resolvePlatformYouTubeOAuthAppSync } = await import('@autotube/config');
  const oauthApp = resolvePlatformYouTubeOAuthAppSync();
  const hasCredentials = !!(oauthApp && config.YOUTUBE_REFRESH_TOKEN);

  if (!hasCredentials) {
    return res.json({
      hasCredentials: false,
      tokenOk: false,
      error: oauthApp
        ? 'Falta refresh token de YouTube (desarrollo)'
        : 'Configura Client ID/Secret en Ajustes → Secretos de plataforma',
      channelTitle: null,
      organizationId: orgId ?? null,
    });
  }

  try {
    const oauth2 = new google.auth.OAuth2(oauthApp!.clientId, oauthApp!.clientSecret);
    oauth2.setCredentials({ refresh_token: config.YOUTUBE_REFRESH_TOKEN });
    const { credentials } = await oauth2.refreshAccessToken();

    const youtube = google.youtube({ version: 'v3', auth: oauth2 });
    const channels = await youtube.channels.list({
      part: ['snippet'],
      mine: true,
    });

    const channelTitle = channels.data.items?.[0]?.snippet?.title ?? null;

    let analyticsOk = false;
    let analyticsError: string | null = null;
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

    res.json({
      hasCredentials: true,
      tokenOk: !!credentials.access_token,
      error: null,
      organizationId: orgId ?? null,
      channelTitle,
      privacyStatus: config.YOUTUBE_PRIVACY_STATUS ?? 'private',
      analyticsOk,
      analyticsError,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.json({
      hasCredentials: true,
      tokenOk: false,
      error: message,
      organizationId: orgId ?? null,
      channelTitle: null,
    });
  }
});
