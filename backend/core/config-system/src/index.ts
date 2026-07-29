import { z } from 'zod';
import type { ChannelConfig } from '@autotube/shared';
import { getOrgPipelineOverrides } from './org-runtime.js';
import { getPlatformSecretsOverrides } from './platform-secrets-runtime.js';
import { PRODUCT_DEFAULTS } from './product-defaults.js';
import {
  resolveGenerateAiImages,
  resolveImageQuality,
  resolveMaxAiImagesPerVideo,
  resolveMaxScenesLong,
  resolveMaxScenesShort,
  resolveMinScenesLong,
  resolveTtsProvider,
} from './resolve-settings.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  // TTS — defaults from PRODUCT_DEFAULTS (preferencias en canal/org; .env no documenta producto)
  TTS_PROVIDER: z
    .enum(['auto', 'elevenlabs', 'edge', 'openai', 'mock'])
    .default(PRODUCT_DEFAULTS.ttsProvider),
  TTS_ENABLE_EDGE: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default(PRODUCT_DEFAULTS.elevenLabsVoiceId),
  ELEVENLABS_MODEL: z.string().default(PRODUCT_DEFAULTS.elevenLabsModel),
  ELEVENLABS_OUTPUT_FORMAT: z.string().default(PRODUCT_DEFAULTS.elevenLabsOutputFormat),
  ELEVENLABS_LANGUAGE_CODE: z.string().default(PRODUCT_DEFAULTS.elevenLabsLanguageCode),
  ELEVENLABS_STABILITY: z.coerce.number().min(0).max(1).default(PRODUCT_DEFAULTS.elevenLabsStability),
  ELEVENLABS_SIMILARITY: z.coerce.number().min(0).max(1).default(PRODUCT_DEFAULTS.elevenLabsSimilarity),
  ELEVENLABS_STYLE: z.coerce.number().min(0).max(1).default(PRODUCT_DEFAULTS.elevenLabsStyle),
  EDGE_TTS_VOICE: z.string().default(PRODUCT_DEFAULTS.edgeTtsVoice),
  EDGE_TTS_RATE: z.string().default(PRODUCT_DEFAULTS.edgeTtsRate),
  EDGE_TTS_VOLUME: z.string().default(PRODUCT_DEFAULTS.edgeTtsVolume),
  EDGE_TTS_PITCH: z.string().default(PRODUCT_DEFAULTS.edgeTtsPitch),
  OPENAI_API_KEY: z.string().optional(),
  /**
   * LLM for ideas/scripts/titles (OpenAI-compatible).
   * auto = DeepSeek if DEEPSEEK_API_KEY set, else OpenAI. Images/TTS never use DeepSeek.
   */
  LLM_PROVIDER: z.enum(['auto', 'deepseek', 'openai']).default(PRODUCT_DEFAULTS.llmProvider),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.string().default(PRODUCT_DEFAULTS.deepseekModel),
  OPENAI_MODEL: z.string().default(PRODUCT_DEFAULTS.openaiModel),
  OPENAI_MODEL_SCRIPT: z.string().optional(),
  OPENAI_MODEL_DEV: z.string().default(PRODUCT_DEFAULTS.openaiModel),
  SCRIPT_DEV_MODE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  OPENAI_TTS_VOICE: z.string().default(PRODUCT_DEFAULTS.openaiTtsVoice),
  OPENAI_TTS_MODEL: z.string().default(PRODUCT_DEFAULTS.openaiTtsModel),
  OPENAI_TTS_SPEED: z.coerce.number().min(0.25).max(4).default(PRODUCT_DEFAULTS.openaiTtsSpeed),
  OPENAI_IMAGE_MODEL: z.string().default(PRODUCT_DEFAULTS.openaiImageModel),
  OPENAI_IMAGE_QUALITY: z
    .enum(['low', 'medium', 'high', 'auto'])
    .default(PRODUCT_DEFAULTS.openaiImageQuality),
  GENERATE_DALLE_IMAGES: z
    .string()
    .transform((v) => v === 'true')
    .default(PRODUCT_DEFAULTS.generateAiImages ? 'true' : 'false'),
  FORCE_AI_IMAGES_ON_PAID: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  MAX_AI_IMAGES_PER_VIDEO: z.coerce
    .number()
    .int()
    .min(0)
    .max(100)
    .default(PRODUCT_DEFAULTS.maxAiImagesPerVideo),
  THUMBNAIL_VARIANTS: z.coerce.number().int().min(1).max(3).default(1),
  PIPELINE_MAX_SCENES: z.coerce.number().optional(),
  PIPELINE_MIN_SCENES_LONG: z.coerce.number().default(PRODUCT_DEFAULTS.minScenesLong),
  PIPELINE_MAX_SCENES_SHORT: z.coerce.number().default(PRODUCT_DEFAULTS.maxScenesShort),
  PIPELINE_MAX_SCENES_LONG: z.coerce.number().default(PRODUCT_DEFAULTS.maxScenesLong),
  OPENAI_MAX_TOKENS: z.coerce.number().default(PRODUCT_DEFAULTS.openaiMaxTokens),
  OPENAI_MAX_TOKENS_LONG: z.coerce.number().default(PRODUCT_DEFAULTS.openaiMaxTokensLong),
  API_PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  STORAGE_PATH: z.string().default('./storage'),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_REFRESH_TOKEN: z.string().optional(),
  YOUTUBE_PRIVACY_STATUS: z.enum(['public', 'unlisted', 'private']).default('public'),
  SHORTS_CLIP_MAX_SEC: z.coerce.number().default(PRODUCT_DEFAULTS.shortsClipMaxSec),
  DEFAULT_REVIEW_REQUIRED: z
    .string()
    .transform((v) => v === 'true')
    .default(PRODUCT_DEFAULTS.reviewRequired ? 'true' : 'false'),
  DEFAULT_MIN_VIRAL_SCORE: z.coerce
    .number()
    .min(0)
    .max(100)
    .default(PRODUCT_DEFAULTS.minViralScore),
  IDEA_MAX_RETRIES: z.coerce.number().int().min(1).max(20).default(PRODUCT_DEFAULTS.ideaMaxRetries),
  SCRIPT_GENERATION_MODE: z.enum(['monolithic', 'chunked']).optional(),
  SCRIPT_MONOLITHIC_FALLBACK: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  MOCK_EXTERNAL_APIS: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  AUTH_SECRET: z.string().optional(),
  AUTH_REQUIRED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  DEFAULT_ADMIN_EMAIL: z.string().email().default('adripardo72@gmail.com'),
  DEFAULT_ADMIN_PASSWORD: z.string().default('changeme'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_UNLIMITED: z.string().optional(),
  STRIPE_TAX_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  CREDENTIALS_ENCRYPTION_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Reelpath <noreply@reelpath.io>'),
  BREVO_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  PEXELS_API_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  /** URL pública base del CDN o bucket S3 (p. ej. https://cdn.example.com o https://bucket.r2.dev) */
  CDN_URL: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema> & {
  useMocks: boolean;
};

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid config: ${parsed.error.message}`);
  }

  const hasRealTts =
    !!parsed.data.ELEVENLABS_API_KEY ||
    !!parsed.data.OPENAI_API_KEY ||
    parsed.data.TTS_ENABLE_EDGE;

  const hasLlmKey = !!(parsed.data.OPENAI_API_KEY || parsed.data.DEEPSEEK_API_KEY);

  const useMocks =
    parsed.data.MOCK_EXTERNAL_APIS || (!hasLlmKey && !hasRealTts);

  if (parsed.data.AUTH_REQUIRED && !parsed.data.AUTH_SECRET) {
    throw new Error('AUTH_SECRET is required when AUTH_REQUIRED=true');
  }

  const cfg: AppConfig = { ...parsed.data, useMocks };
  validateProductionConfig(cfg);
  cached = cfg;
  return cached;
}

function validateProductionConfig(cfg: AppConfig): void {
  if (cfg.NODE_ENV !== 'production') return;

  if (cfg.AUTH_REQUIRED !== true) {
    throw new Error('En producción se exige AUTH_REQUIRED=true');
  }

  // Atlas shared-host / demo: allow mock + deferred YouTube/BYOK until secrets are set.
  const atlasHosted = process.env.ATLAS_HOSTED === 'true';
  if (atlasHosted) {
    return;
  }

  if (cfg.MOCK_EXTERNAL_APIS !== false) {
    throw new Error('En producción se exige MOCK_EXTERNAL_APIS=false');
  }
  if (!cfg.CREDENTIALS_ENCRYPTION_KEY?.trim()) {
    throw new Error('En producción se exige CREDENTIALS_ENCRYPTION_KEY (BYOK) configurada');
  }

  // YouTube OAuth app: client/secret viven en PlatformSecret (BD), no en .env.
  // El redirect URI sí puede venir de env / DOMAIN.

  // Stripe: solo exigimos el set completo cuando se usa clave live
  const stripeKey = cfg.STRIPE_SECRET_KEY?.trim();
  const isStripeLive = !!stripeKey && stripeKey.startsWith('sk_live_');
  if (isStripeLive) {
    if (!cfg.STRIPE_WEBHOOK_SECRET?.trim()) {
      throw new Error('Stripe live exige STRIPE_WEBHOOK_SECRET');
    }
    if (!cfg.STRIPE_PRICE_STARTER?.trim() || !cfg.STRIPE_PRICE_PRO?.trim() || !cfg.STRIPE_PRICE_UNLIMITED?.trim()) {
      throw new Error('Stripe live exige STRIPE_PRICE_STARTER/PRO/UNLIMITED');
    }
  }
}

export const channelConfigSchema = z.object({
  niche: z.string().min(1),
  videoFormat: z.enum(['shorts', 'long']),
  aspectRatio: z.enum(['9:16', '16:9']),
  templateId: z.string().min(1),
  autoPublish: z.boolean().default(false),
  reviewRequired: z.boolean().default(true),
  ideasPerRun: z.number().int().min(1).max(50).default(3),
  language: z.string().default('es'),
  brandName: z.string().max(120).optional(),
  tone: z.string().max(200).optional(),
  targetAudience: z.string().max(300).optional(),
  forbiddenTopics: z.array(z.string().max(120)).max(30).default([]),
  customPromptHints: z.string().max(2000).optional(),
  contentDisclaimer: z.string().max(500).optional(),
  publishYoutube: z.boolean().default(true),
  publishYoutubeShorts: z.boolean().default(false),
  shortsClipMaxSec: z.coerce.number().min(15).max(600).default(60),
  minViralScore: z.coerce.number().min(0).max(100).default(0),
  maxIdeaRetries: z.coerce.number().int().min(1).max(20).optional(),
  targetDurationMinSec: z.coerce.number().int().min(120).max(3600).default(480),
  targetDurationMaxSec: z.coerce.number().int().min(120).max(3600).default(900),
  retentionMode: z.boolean().default(false),
  autoReview: z.boolean().default(false),
  autoApproveMinScore: z.coerce.number().min(0).max(100).default(80),
  shortsMode: z.enum(['split', 'dedicated', 'mixed']).default('split'),
  shortsPerVideo: z.coerce.number().int().min(1).max(7).default(1),
  longShortsFromVideo: z.coerce.number().int().min(1).max(3).optional(),
  shortsPublishIntervalDays: z.coerce.number().int().min(0).max(30).default(1),
  timezone: z.string().min(1).default('Europe/Madrid'),
  publishPlannerEnabled: z.boolean().default(false),
  maxLongsPerWeek: z.coerce.number().int().min(1).max(7).default(1),
  preferredPublishHour: z.coerce.number().int().min(0).max(23).default(19),
  preferredPublishDays: z.array(z.coerce.number().int().min(0).max(6)).default([5]),
  minDaysBetweenLongs: z.coerce.number().int().min(1).max(14).optional(),
  shortPreferredSlots: z
    .array(
      z.object({
        hour: z.coerce.number().int().min(0).max(23),
        minute: z.coerce.number().int().min(0).max(59),
      }),
    )
    .optional(),
  scriptGenerationMode: z.enum(['monolithic', 'chunked']).optional(),
  videoMotionIntensity: z.enum(['subtle', 'normal', 'dynamic']).optional(),
  visualSourceMode: z.enum(['image', 'stock', 'mixed']).optional(),
  maxScenesLong: z.union([z.coerce.number().int().min(4).max(40), z.null()]).optional(),
  minScenesLong: z.union([z.coerce.number().int().min(2).max(40), z.null()]).optional(),
  maxScenesShort: z.union([z.coerce.number().int().min(1).max(12), z.null()]).optional(),
  generateAiImages: z.union([z.boolean(), z.null()]).optional(),
  maxAiImagesPerVideo: z.union([z.coerce.number().int().min(0).max(100), z.null()]).optional(),
  openaiImageQuality: z
    .union([z.enum(['low', 'medium', 'high', 'auto']), z.null()])
    .optional(),
  ttsProvider: z
    .union([z.enum(['auto', 'edge', 'elevenlabs', 'openai']), z.null()])
    .optional(),
  edgeTtsVoice: z.union([z.string().min(2).max(120), z.null()]).optional(),
  elevenLabsVoiceId: z.union([z.string().min(2).max(120), z.null()]).optional(),
  openaiTtsVoice: z.union([z.string().min(2).max(120), z.null()]).optional(),
});

export function getIdeaMaxRetries(channelMax?: number): number {
  return channelMax ?? PRODUCT_DEFAULTS.ideaMaxRetries;
}

export type GetMaxScenesOptions = {
  retentionMode?: boolean;
  maxScenesLong?: number | null;
  maxScenesShort?: number | null;
};

export function getMaxScenes(
  format: 'shorts' | 'long',
  options?: GetMaxScenesOptions,
): number {
  const org = getOrgPipelineOverrides();
  const retention = options?.retentionMode ?? false;
  let max: number;
  if (format === 'long') {
    max = resolveMaxScenesLong({
      channelMaxScenesLong: options?.maxScenesLong,
      orgMaxScenesLong: org?.maxScenesLong,
      codeDefault: PRODUCT_DEFAULTS.maxScenesLong,
    });
  } else {
    max = resolveMaxScenesShort({
      channelMaxScenesShort: options?.maxScenesShort ?? org?.maxScenesShort,
      codeDefault: retention ? 5 : PRODUCT_DEFAULTS.maxScenesShort,
    });
  }
  if (format === 'long') {
    max = Math.max(max, getMinScenes('long', options));
  }
  return max;
}

export function getOpenAiMaxTokens(format: 'shorts' | 'long'): number {
  const config = loadConfig();
  return format === 'long' ? config.OPENAI_MAX_TOKENS_LONG : config.OPENAI_MAX_TOKENS;
}

/** Cheaper / safer defaults for local development and SCRIPT_DEV_MODE. */
export function isScriptDevMode(): boolean {
  const config = loadConfig();
  return config.SCRIPT_DEV_MODE || config.NODE_ENV === 'development';
}

export type LlmProviderName = 'deepseek' | 'openai';

function effectiveLlmProviderPreference(options?: {
  orgOpenAiApiKey?: string | null;
}): 'auto' | 'deepseek' | 'openai' {
  const org = getOrgPipelineOverrides();
  const orgPref = org?.llmProvider;
  if (orgPref === 'deepseek' || orgPref === 'openai' || orgPref === 'auto') {
    return orgPref;
  }
  return loadConfig().LLM_PROVIDER;
}

function effectiveDeepseekApiKey(): string | undefined {
  const org = getOrgPipelineOverrides();
  const platform = getPlatformSecretsOverrides();
  return (
    org?.deepseekApiKey?.trim() ||
    platform?.deepseekApiKey?.trim() ||
    loadConfig().DEEPSEEK_API_KEY?.trim() ||
    undefined
  );
}

function effectiveOpenAiApiKey(options?: { orgOpenAiApiKey?: string | null }): string | undefined {
  const org = getOrgPipelineOverrides();
  const platform = getPlatformSecretsOverrides();
  return (
    options?.orgOpenAiApiKey?.trim() ||
    org?.openAiApiKey?.trim() ||
    platform?.openAiApiKey?.trim() ||
    loadConfig().OPENAI_API_KEY?.trim() ||
    undefined
  );
}

/** Platform + env fallback for ElevenLabs (org BYOK applied in loadEffectiveConfig). */
export function effectiveElevenLabsApiKey(): string | undefined {
  const org = getOrgPipelineOverrides();
  const platform = getPlatformSecretsOverrides();
  return (
    org?.elevenLabsApiKey?.trim() ||
    platform?.elevenLabsApiKey?.trim() ||
    loadConfig().ELEVENLABS_API_KEY?.trim() ||
    undefined
  );
}

export function effectivePexelsApiKey(): string | undefined {
  const platform = getPlatformSecretsOverrides();
  return platform?.pexelsApiKey?.trim() || loadConfig().PEXELS_API_KEY?.trim() || undefined;
}

/** YouTube OAuth app credentials: PlatformSecret cache, then legacy env. */
export function resolvePlatformYouTubeOAuthAppSync(): {
  clientId: string;
  clientSecret: string;
} | null {
  const platform = getPlatformSecretsOverrides();
  const fromCache =
    platform?.youtubeClientId?.trim() && platform?.youtubeClientSecret?.trim()
      ? {
          clientId: platform.youtubeClientId.trim(),
          clientSecret: platform.youtubeClientSecret.trim(),
        }
      : null;
  if (fromCache) return fromCache;

  const cfg = loadConfig();
  if (cfg.YOUTUBE_CLIENT_ID?.trim() && cfg.YOUTUBE_CLIENT_SECRET?.trim()) {
    return {
      clientId: cfg.YOUTUBE_CLIENT_ID.trim(),
      clientSecret: cfg.YOUTUBE_CLIENT_SECRET.trim(),
    };
  }
  return null;
}

/**
 * Resolve chat LLM provider for ideas/scripts.
 * Org preference (UI) wins over .env; org BYOK keys enable that provider.
 * With preference=auto, org BYOK OpenAI alone forces openai (client pays).
 */
export function resolveLlmProvider(options?: {
  orgOpenAiApiKey?: string | null;
}): LlmProviderName {
  const preference = effectiveLlmProviderPreference(options);
  const hasDeepseek = !!effectiveDeepseekApiKey();
  const hasOpenAi = !!effectiveOpenAiApiKey(options);
  const orgByokOpenAi = !!(
    options?.orgOpenAiApiKey?.trim() || getOrgPipelineOverrides()?.openAiApiKey?.trim()
  );

  if (preference === 'deepseek') {
    if (hasDeepseek) return 'deepseek';
    return hasOpenAi ? 'openai' : 'deepseek';
  }
  if (preference === 'openai') {
    return 'openai';
  }

  // auto: prefer DeepSeek for cost; org BYOK OpenAI wins when set
  if (orgByokOpenAi) return 'openai';
  if (hasDeepseek) return 'deepseek';
  return 'openai';
}

/** Model id for the active chat LLM (DeepSeek or OpenAI). */
export function getLlmModel(options?: { orgOpenAiApiKey?: string | null }): string {
  const config = loadConfig();
  const provider = resolveLlmProvider(options);
  if (provider === 'deepseek') {
    return config.DEEPSEEK_MODEL.trim() || 'deepseek-v4-flash';
  }
  if (isScriptDevMode() && config.OPENAI_MODEL_DEV) {
    return config.OPENAI_MODEL_DEV;
  }
  return config.OPENAI_MODEL_SCRIPT?.trim() || config.OPENAI_MODEL;
}

/** @deprecated Prefer getLlmModel — kept for call sites that mean “script model”. */
export function getOpenAiModel(): string {
  return getLlmModel();
}

export function resolveLlmConnection(options?: {
  orgOpenAiApiKey?: string | null;
}): { provider: LlmProviderName; apiKey: string; baseURL?: string; model: string } | null {
  const config = loadConfig();
  const provider = resolveLlmProvider(options);
  const model = getLlmModel(options);

  if (provider === 'deepseek') {
    const apiKey = effectiveDeepseekApiKey();
    if (!apiKey) return null;
    return {
      provider,
      apiKey,
      baseURL: config.DEEPSEEK_BASE_URL.replace(/\/$/, ''),
      model,
    };
  }

  const apiKey = effectiveOpenAiApiKey(options);
  if (!apiKey) return null;
  return { provider, apiKey, model };
}

/**
 * Config with org (+ merged channel) pipeline overrides applied.
 * Product prefs resolve channel > org > code defaults (not .env).
 */
export function loadEffectiveConfig(): AppConfig {
  const base = loadConfig();
  const org = getOrgPipelineOverrides();
  if (!org) {
    return {
      ...base,
      TTS_PROVIDER: PRODUCT_DEFAULTS.ttsProvider,
      GENERATE_DALLE_IMAGES: PRODUCT_DEFAULTS.generateAiImages,
      PIPELINE_MAX_SCENES_LONG: PRODUCT_DEFAULTS.maxScenesLong,
      PIPELINE_MIN_SCENES_LONG: PRODUCT_DEFAULTS.minScenesLong,
      PIPELINE_MAX_SCENES_SHORT: PRODUCT_DEFAULTS.maxScenesShort,
      MAX_AI_IMAGES_PER_VIDEO: PRODUCT_DEFAULTS.maxAiImagesPerVideo,
      OPENAI_IMAGE_QUALITY: PRODUCT_DEFAULTS.openaiImageQuality,
      EDGE_TTS_VOICE: PRODUCT_DEFAULTS.edgeTtsVoice,
      ELEVENLABS_VOICE_ID: PRODUCT_DEFAULTS.elevenLabsVoiceId,
      OPENAI_TTS_VOICE: PRODUCT_DEFAULTS.openaiTtsVoice,
    };
  }

  const llmProvider =
    org.llmProvider === 'deepseek' || org.llmProvider === 'openai' || org.llmProvider === 'auto'
      ? org.llmProvider
      : PRODUCT_DEFAULTS.llmProvider;

  const ttsProvider = resolveTtsProvider({
    channelTtsProvider: org.ttsProvider,
    orgTtsProvider: org.ttsProvider,
    codeDefault: PRODUCT_DEFAULTS.ttsProvider,
  });

  return {
    ...base,
    LLM_PROVIDER: llmProvider,
    TTS_PROVIDER: ttsProvider,
    GENERATE_DALLE_IMAGES: resolveGenerateAiImages({
      channelGenerateAiImages: org.generateAiImages,
      orgGenerateAiImages: org.generateAiImages,
      codeDefault: PRODUCT_DEFAULTS.generateAiImages,
    }),
    PIPELINE_MAX_SCENES_LONG: resolveMaxScenesLong({
      channelMaxScenesLong: org.maxScenesLong,
      orgMaxScenesLong: org.maxScenesLong,
      codeDefault: PRODUCT_DEFAULTS.maxScenesLong,
    }),
    PIPELINE_MIN_SCENES_LONG: resolveMinScenesLong({
      channelMinScenesLong: org.minScenesLong,
      orgMinScenesLong: org.minScenesLong,
      codeDefault: PRODUCT_DEFAULTS.minScenesLong,
    }),
    PIPELINE_MAX_SCENES_SHORT: resolveMaxScenesShort({
      channelMaxScenesShort: org.maxScenesShort,
      codeDefault: PRODUCT_DEFAULTS.maxScenesShort,
    }),
    MAX_AI_IMAGES_PER_VIDEO: resolveMaxAiImagesPerVideo({
      channelMaxAiImagesPerVideo: org.maxAiImagesPerVideo,
      orgMaxAiImagesPerVideo: org.maxAiImagesPerVideo,
      codeDefault: PRODUCT_DEFAULTS.maxAiImagesPerVideo,
    }),
    OPENAI_IMAGE_QUALITY: resolveImageQuality({
      channelOpenaiImageQuality: org.openaiImageQuality,
      orgOpenaiImageQuality: org.openaiImageQuality,
      codeDefault: PRODUCT_DEFAULTS.openaiImageQuality,
    }),
    EDGE_TTS_VOICE: org.edgeTtsVoice?.trim() || PRODUCT_DEFAULTS.edgeTtsVoice,
    ELEVENLABS_VOICE_ID: org.elevenLabsVoiceId?.trim() || PRODUCT_DEFAULTS.elevenLabsVoiceId,
    OPENAI_TTS_VOICE: org.openaiTtsVoice?.trim() || PRODUCT_DEFAULTS.openaiTtsVoice,
    OPENAI_API_KEY: org.openAiApiKey?.trim() || getPlatformSecretsOverrides()?.openAiApiKey?.trim() || base.OPENAI_API_KEY,
    DEEPSEEK_API_KEY:
      org.deepseekApiKey?.trim() || getPlatformSecretsOverrides()?.deepseekApiKey?.trim() || base.DEEPSEEK_API_KEY,
    ELEVENLABS_API_KEY:
      org.elevenLabsApiKey?.trim() ||
      getPlatformSecretsOverrides()?.elevenLabsApiKey?.trim() ||
      base.ELEVENLABS_API_KEY,
    PEXELS_API_KEY: getPlatformSecretsOverrides()?.pexelsApiKey?.trim() || base.PEXELS_API_KEY,
  };
}

/** Whether scene images may use paid AI (DALL·E / gpt-image), ignoring per-video caps. */
export function isAiSceneImagesEnabled(
  _orgPlan?: string | null,
  options?: { channelGenerateAiImages?: boolean | null },
): boolean {
  const org = getOrgPipelineOverrides();
  return resolveGenerateAiImages({
    channelGenerateAiImages: options?.channelGenerateAiImages ?? org?.generateAiImages,
    orgGenerateAiImages: org?.generateAiImages,
    codeDefault: PRODUCT_DEFAULTS.generateAiImages,
  });
}

export function getMinScenes(
  format: 'shorts' | 'long',
  options?: { retentionMode?: boolean; minScenesLong?: number | null },
): number {
  const retention = options?.retentionMode ?? false;
  const org = getOrgPipelineOverrides();
  if (format === 'long') {
    return resolveMinScenesLong({
      channelMinScenesLong: options?.minScenesLong ?? org?.minScenesLong,
      orgMinScenesLong: org?.minScenesLong,
      codeDefault: PRODUCT_DEFAULTS.minScenesLong,
    });
  }
  return retention ? 4 : 2;
}

export function parseChannelConfig(raw: unknown): ChannelConfig {
  const parsed = channelConfigSchema.parse({
    reviewRequired: PRODUCT_DEFAULTS.reviewRequired,
    autoPublish: !PRODUCT_DEFAULTS.reviewRequired,
    minViralScore: PRODUCT_DEFAULTS.minViralScore,
    shortsClipMaxSec: PRODUCT_DEFAULTS.shortsClipMaxSec,
    visualSourceMode: 'mixed',
    ...((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>),
  });
  // null = inherit org/code — strip so JSON stays clean
  const nullableKeys = [
    'maxScenesLong',
    'minScenesLong',
    'maxScenesShort',
    'generateAiImages',
    'maxAiImagesPerVideo',
    'openaiImageQuality',
    'ttsProvider',
    'edgeTtsVoice',
    'elevenLabsVoiceId',
    'openaiTtsVoice',
  ] as const;
  for (const key of nullableKeys) {
    if ((parsed as Record<string, unknown>)[key] == null) {
      delete (parsed as Record<string, unknown>)[key];
    }
  }
  return parsed;
}

export function getStoragePath(...segments: string[]): string {
  const base = loadConfig().STORAGE_PATH;
  return [base, ...segments].join('/').replace(/\/+/g, '/');
}

export {
  ensureLocalFile,
  getPublicMediaUrl,
  getStorageBackend,
  isS3Configured,
  mirrorToS3IfConfigured,
  resolveLocalStoragePath,
  writeStorageFile,
  type StorageBackend,
} from './storage.js';

export {
  decryptCredentialPayload,
  encryptCredentialPayload,
  isCredentialEncryptionEnabled,
  isEncryptedCredentialData,
} from './credential-crypto.js';
export {
  clearOrgPipelineOverrides,
  getOrgPipelineOverrides,
  mergeChannelProductOverrides,
  mergeChannelVoiceOverrides,
  setOrgPipelineOverrides,
  type OrgImageQuality,
  type OrgLlmProvider,
  type OrgPipelineOverrides,
  type OrgTtsProvider,
} from './org-runtime.js';
export {
  clearPlatformSecretsOverrides,
  getPlatformSecretsOverrides,
  setPlatformSecretsOverrides,
  type PlatformSecretsOverrides,
} from './platform-secrets-runtime.js';
export { PRODUCT_DEFAULTS } from './product-defaults.js';
export {
  resolveGenerateAiImages,
  resolveImageQuality,
  resolveMaxAiImagesPerVideo,
  resolveMaxScenesLong,
  resolveMaxScenesShort,
  resolveMinScenesLong,
  resolveTtsProvider,
} from './resolve-settings.js';
export {
  buildOrgInviteEmail,
  buildPaymentFailedEmail,
  buildPipelineCompletedEmail,
  buildPipelineFailedEmail,
  buildTrialEndingEmail,
  buildWelcomeEmail,
  isEmailConfigured,
  sendEmail,
  type EmailTemplateId,
  type SendEmailParams,
  type SendEmailResult,
} from './email.js';
