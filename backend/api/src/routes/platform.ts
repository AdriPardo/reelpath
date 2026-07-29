import { Router } from 'express';
import { z } from 'zod';
import { loadConfig } from '@autotube/config';
import {
  deletePlatformSecret,
  getPlatformSecretsStatus,
  loadPlatformSecretsOverrides,
  upsertPlatformApiKey,
  upsertPlatformYouTubeOAuthApp,
} from '@autotube/database';
import { getYouTubeOAuthRedirectUri } from '../lib/youtube-oauth.js';
import { authMiddleware, requireOwner } from '../middleware/auth.js';

export const platformRouter = Router();

platformRouter.use(authMiddleware);
platformRouter.use(requireOwner);

const patchSchema = z
  .object({
    youtubeClientId: z.string().min(1).max(500).optional(),
    youtubeClientSecret: z.string().min(1).max(500).optional(),
    clearYoutubeOAuthApp: z.boolean().optional(),
    openaiApiKey: z.string().min(1).max(500).optional(),
    clearOpenaiApiKey: z.boolean().optional(),
    deepseekApiKey: z.string().min(1).max(500).optional(),
    clearDeepseekApiKey: z.boolean().optional(),
    elevenLabsApiKey: z.string().min(1).max(500).optional(),
    clearElevenLabsApiKey: z.boolean().optional(),
    pexelsApiKey: z.string().min(1).max(500).optional(),
    clearPexelsApiKey: z.boolean().optional(),
  })
  .refine(
    (b) =>
      b.clearYoutubeOAuthApp ||
      b.clearOpenaiApiKey ||
      b.clearDeepseekApiKey ||
      b.clearElevenLabsApiKey ||
      b.clearPexelsApiKey ||
      b.youtubeClientId !== undefined ||
      b.youtubeClientSecret !== undefined ||
      b.openaiApiKey !== undefined ||
      b.deepseekApiKey !== undefined ||
      b.elevenLabsApiKey !== undefined ||
      b.pexelsApiKey !== undefined,
    { message: 'Nada que actualizar' },
  );

platformRouter.get('/secrets', async (_req, res) => {
  const status = await getPlatformSecretsStatus();
  res.json({
    ...status,
    youtubeOAuthRedirectUri: getYouTubeOAuthRedirectUri(),
  });
});

platformRouter.patch('/secrets', async (req, res) => {
  const body = patchSchema.parse(req.body);

  if (body.clearYoutubeOAuthApp) {
    await deletePlatformSecret('youtube_oauth_app');
  } else if (body.youtubeClientId !== undefined || body.youtubeClientSecret !== undefined) {
    const status = await getPlatformSecretsStatus();
    if (!status.hasYoutubeOAuthApp && (!body.youtubeClientId || !body.youtubeClientSecret)) {
      return res.status(400).json({
        error: 'Para configurar YouTube OAuth hace falta Client ID y Client Secret',
      });
    }
    if (body.youtubeClientId && body.youtubeClientSecret) {
      await upsertPlatformYouTubeOAuthApp({
        clientId: body.youtubeClientId,
        clientSecret: body.youtubeClientSecret,
      });
    } else {
      return res.status(400).json({
        error: 'Envía Client ID y Client Secret juntos para actualizar la app OAuth',
      });
    }
  }

  if (body.clearOpenaiApiKey) await deletePlatformSecret('openai');
  else if (body.openaiApiKey) await upsertPlatformApiKey('openai', body.openaiApiKey);

  if (body.clearDeepseekApiKey) await deletePlatformSecret('deepseek');
  else if (body.deepseekApiKey) await upsertPlatformApiKey('deepseek', body.deepseekApiKey);

  if (body.clearElevenLabsApiKey) await deletePlatformSecret('elevenlabs');
  else if (body.elevenLabsApiKey) await upsertPlatformApiKey('elevenlabs', body.elevenLabsApiKey);

  if (body.clearPexelsApiKey) await deletePlatformSecret('pexels');
  else if (body.pexelsApiKey) await upsertPlatformApiKey('pexels', body.pexelsApiKey);

  await loadPlatformSecretsOverrides();
  const status = await getPlatformSecretsStatus();
  res.json({
    ...status,
    youtubeOAuthRedirectUri: getYouTubeOAuthRedirectUri(),
    message: 'Secretos de plataforma actualizados',
  });
});

/** Devuelve redirect URI sin secretos (útil para owners al configurar Google Cloud). */
platformRouter.get('/youtube-oauth-redirect', (_req, res) => {
  const config = loadConfig();
  res.json({
    redirectUri: getYouTubeOAuthRedirectUri(),
    frontendUrl: config.FRONTEND_URL,
  });
});
