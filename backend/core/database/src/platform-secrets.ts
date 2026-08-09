import {
  decryptCredentialPayload,
  encryptCredentialPayload,
  setPlatformSecretsOverrides,
  type PlatformSecretsOverrides,
} from '@autotube/config';
import { prisma } from './index.js';

export const PLATFORM_SECRET_KEYS = [
  'youtube_oauth_app',
  'openai',
  'deepseek',
  'elevenlabs',
  'pexels',
  'pixabay',
  'coverr',
  'upload_post',
] as const;

export type PlatformSecretKey = (typeof PLATFORM_SECRET_KEYS)[number];

export type PlatformApiKeyProvider =
  | 'openai'
  | 'deepseek'
  | 'elevenlabs'
  | 'pexels'
  | 'pixabay'
  | 'coverr';

export type PlatformSecretsStatus = {
  hasYoutubeOAuthApp: boolean;
  hasOpenaiKey: boolean;
  hasDeepseekKey: boolean;
  hasElevenLabsKey: boolean;
  hasPexelsKey: boolean;
  hasPixabayKey: boolean;
  hasCoverrKey: boolean;
  hasUploadPost: boolean;
};

function isPlatformSecretKey(key: string): key is PlatformSecretKey {
  return (PLATFORM_SECRET_KEYS as readonly string[]).includes(key);
}

async function readSecretData(key: PlatformSecretKey): Promise<Record<string, unknown> | null> {
  const row = await prisma.platformSecret.findUnique({ where: { key } });
  if (!row) return null;
  return decryptCredentialPayload(row.data);
}

async function upsertSecretData(key: PlatformSecretKey, payload: Record<string, unknown>): Promise<void> {
  const data = encryptCredentialPayload(payload) as object;
  await prisma.platformSecret.upsert({
    where: { key },
    create: { key, data },
    update: { data },
  });
}

export async function deletePlatformSecret(key: PlatformSecretKey): Promise<void> {
  await prisma.platformSecret.deleteMany({ where: { key } });
}

export async function getPlatformSecretsStatus(): Promise<PlatformSecretsStatus> {
  const rows = await prisma.platformSecret.findMany({
    where: { key: { in: [...PLATFORM_SECRET_KEYS] } },
    select: { key: true, data: true },
  });

  const byKey = new Map(rows.map((r) => [r.key, r.data]));

  function hasApiKey(key: PlatformSecretKey): boolean {
    const raw = byKey.get(key);
    if (!raw) return false;
    const data = decryptCredentialPayload(raw);
    return typeof data?.apiKey === 'string' && data.apiKey.trim().length > 0;
  }

  const yt = byKey.has('youtube_oauth_app')
    ? decryptCredentialPayload(byKey.get('youtube_oauth_app'))
    : null;
  const hasYoutubeOAuthApp = !!(
    typeof yt?.clientId === 'string' &&
    yt.clientId.trim() &&
    typeof yt?.clientSecret === 'string' &&
    yt.clientSecret.trim()
  );

  return {
    hasYoutubeOAuthApp,
    hasOpenaiKey: hasApiKey('openai'),
    hasDeepseekKey: hasApiKey('deepseek'),
    hasElevenLabsKey: hasApiKey('elevenlabs'),
    hasPexelsKey: hasApiKey('pexels'),
    hasPixabayKey: hasApiKey('pixabay'),
    hasCoverrKey: hasApiKey('coverr'),
    hasUploadPost: (() => {
      const raw = byKey.get('upload_post');
      if (!raw) return false;
      const data = decryptCredentialPayload(raw);
      return (
        typeof data?.apiKey === 'string' &&
        data.apiKey.trim().length > 0 &&
        typeof data?.username === 'string' &&
        data.username.trim().length > 0
      );
    })(),
  };
}

export async function resolvePlatformYouTubeOAuthApp(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  const data = await readSecretData('youtube_oauth_app');
  const clientId = typeof data?.clientId === 'string' ? data.clientId.trim() : '';
  const clientSecret = typeof data?.clientSecret === 'string' ? data.clientSecret.trim() : '';
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function upsertPlatformYouTubeOAuthApp(input: {
  clientId: string;
  clientSecret: string;
}): Promise<void> {
  await upsertSecretData('youtube_oauth_app', {
    clientId: input.clientId.trim(),
    clientSecret: input.clientSecret.trim(),
  });
}

export async function resolvePlatformApiKey(
  provider: PlatformApiKeyProvider,
): Promise<string | null> {
  const data = await readSecretData(provider);
  const key = typeof data?.apiKey === 'string' ? data.apiKey.trim() : '';
  return key || null;
}

export async function upsertPlatformApiKey(
  provider: PlatformApiKeyProvider,
  apiKey: string,
): Promise<void> {
  await upsertSecretData(provider, { apiKey: apiKey.trim() });
}

export async function upsertPlatformUploadPost(input: {
  apiKey: string;
  username: string;
  enabled?: boolean;
}): Promise<void> {
  await upsertSecretData('upload_post', {
    apiKey: input.apiKey.trim(),
    username: input.username.trim(),
    enabled: input.enabled !== false,
  });
}

export async function resolvePlatformUploadPost(): Promise<{
  apiKey: string;
  username: string;
  enabled: boolean;
} | null> {
  const data = await readSecretData('upload_post');
  const apiKey = typeof data?.apiKey === 'string' ? data.apiKey.trim() : '';
  const username = typeof data?.username === 'string' ? data.username.trim() : '';
  if (!apiKey || !username) return null;
  return {
    apiKey,
    username,
    enabled: data?.enabled !== false,
  };
}

/** Load all platform secrets into the sync cache used by resolveLlmConnection / TTS. */
export async function loadPlatformSecretsOverrides(): Promise<PlatformSecretsOverrides> {
  const [youtube, openai, deepseek, elevenlabs, pexels, pixabay, coverr, uploadPost] =
    await Promise.all([
      resolvePlatformYouTubeOAuthApp(),
      resolvePlatformApiKey('openai'),
      resolvePlatformApiKey('deepseek'),
      resolvePlatformApiKey('elevenlabs'),
      resolvePlatformApiKey('pexels'),
      resolvePlatformApiKey('pixabay'),
      resolvePlatformApiKey('coverr'),
      resolvePlatformUploadPost(),
    ]);

  const overrides: PlatformSecretsOverrides = {
    youtubeClientId: youtube?.clientId ?? null,
    youtubeClientSecret: youtube?.clientSecret ?? null,
    openAiApiKey: openai,
    deepseekApiKey: deepseek,
    elevenLabsApiKey: elevenlabs,
    pexelsApiKey: pexels,
    pixabayApiKey: pixabay,
    coverrApiKey: coverr,
    uploadPostApiKey: uploadPost?.apiKey ?? null,
    uploadPostUsername: uploadPost?.username ?? null,
    uploadPostEnabled: uploadPost?.enabled ?? null,
  };

  setPlatformSecretsOverrides(overrides);
  return overrides;
}

/**
 * If PlatformSecret is empty but legacy env vars exist, import once into BD
 * and refresh the runtime cache. Safe to call on every boot (no-op when set).
 */
export async function importPlatformSecretsFromEnvIfEmpty(env: {
  YOUTUBE_CLIENT_ID?: string;
  YOUTUBE_CLIENT_SECRET?: string;
  OPENAI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  PEXELS_API_KEY?: string;
  PIXABAY_API_KEY?: string;
  COVERR_API_KEY?: string;
}): Promise<{ imported: PlatformSecretKey[] }> {
  const status = await getPlatformSecretsStatus();
  const imported: PlatformSecretKey[] = [];

  if (
    !status.hasYoutubeOAuthApp &&
    env.YOUTUBE_CLIENT_ID?.trim() &&
    env.YOUTUBE_CLIENT_SECRET?.trim()
  ) {
    await upsertPlatformYouTubeOAuthApp({
      clientId: env.YOUTUBE_CLIENT_ID,
      clientSecret: env.YOUTUBE_CLIENT_SECRET,
    });
    imported.push('youtube_oauth_app');
  }

  const apiImports: Array<{
    key: PlatformApiKeyProvider;
    has: boolean;
    value?: string;
  }> = [
    { key: 'openai', has: status.hasOpenaiKey, value: env.OPENAI_API_KEY },
    { key: 'deepseek', has: status.hasDeepseekKey, value: env.DEEPSEEK_API_KEY },
    { key: 'elevenlabs', has: status.hasElevenLabsKey, value: env.ELEVENLABS_API_KEY },
    { key: 'pexels', has: status.hasPexelsKey, value: env.PEXELS_API_KEY },
    { key: 'pixabay', has: status.hasPixabayKey, value: env.PIXABAY_API_KEY },
    { key: 'coverr', has: status.hasCoverrKey, value: env.COVERR_API_KEY },
  ];

  for (const item of apiImports) {
    if (!item.has && item.value?.trim()) {
      await upsertPlatformApiKey(item.key, item.value);
      imported.push(item.key);
    }
  }

  if (imported.length > 0) {
    await loadPlatformSecretsOverrides();
  }

  return { imported };
}

export function assertPlatformSecretKey(key: string): PlatformSecretKey {
  if (!isPlatformSecretKey(key)) {
    throw new Error(`Clave de secreto de plataforma inválida: ${key}`);
  }
  return key;
}
