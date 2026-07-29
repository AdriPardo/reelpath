import { z } from 'zod';
import type { ChannelConfig } from '@autotube/shared';
import { getOrgPipelineOverrides } from './org-runtime.js';
import {
  resolveGenerateAiImages,
  resolveImageQuality,
  resolveMaxAiImagesPerVideo,
  resolveMaxScenesLong,
} from './resolve-settings.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  // TTS provider priority (TTS_PROVIDER=auto, cost-efficient): Edge (free) → ElevenLabs → OpenAI → mock
  // Set TTS_PROVIDER=elevenlabs for premium voice (paid). Starter/default: prefer free Edge.
  TTS_PROVIDER: z.enum(['auto', 'elevenlabs', 'edge', 'openai', 'mock']).default('auto'),
  TTS_ENABLE_EDGE: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ELEVENLABS_API_KEY: z.string().optional(),
  // Matilda — multilingual, natural Spanish (premade voice)
  ELEVENLABS_VOICE_ID: z.string().default('XrExE9yKIg1WjnnlVkGX'),
  ELEVENLABS_MODEL: z.string().default('eleven_multilingual_v2'),
  ELEVENLABS_OUTPUT_FORMAT: z.string().default('mp3_44100_128'),
  ELEVENLABS_LANGUAGE_CODE: z.string().default('es'),
  ELEVENLABS_STABILITY: z.coerce.number().min(0).max(1).default(0.45),
  ELEVENLABS_SIMILARITY: z.coerce.number().min(0).max(1).default(0.8),
  ELEVENLABS_STYLE: z.coerce.number().min(0).max(1).default(0.15),
  EDGE_TTS_VOICE: z.string().default('es-ES-ElviraNeural'),
  EDGE_TTS_RATE: z.string().default('+0%'),
  EDGE_TTS_VOLUME: z.string().default('+0%'),
  EDGE_TTS_PITCH: z.string().default('+0Hz'),
  OPENAI_API_KEY: z.string().optional(),
  /**
   * LLM for ideas/scripts/titles (OpenAI-compatible).
   * auto = DeepSeek if DEEPSEEK_API_KEY set, else OpenAI. Images/TTS never use DeepSeek.
   */
  LLM_PROVIDER: z.enum(['auto', 'deepseek', 'openai']).default('auto'),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
  /** Prefer deepseek-v4-flash (cheap). Legacy: deepseek-chat (deprecated 2026-07-24). */
  DEEPSEEK_MODEL: z.string().default('deepseek-v4-flash'),
  /** Script/ideas LLM when LLM_PROVIDER=openai (alias: OPENAI_MODEL_SCRIPT). */
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MODEL_SCRIPT: z.string().optional(),
  OPENAI_MODEL_DEV: z.string().default('gpt-4o-mini'),
  SCRIPT_DEV_MODE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  OPENAI_TTS_VOICE: z.string().default('nova'),
  /** tts-1 is ~2× cheaper than tts-1-hd; quality is enough for narration fallback. */
  OPENAI_TTS_MODEL: z.string().default('tts-1'),
  OPENAI_TTS_SPEED: z.coerce.number().min(0.25).max(4).default(1),
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-1'),
  /** gpt-image-* quality: low | medium | high | auto. medium ≈ 3–5× cheaper than high. */
  OPENAI_IMAGE_QUALITY: z.enum(['low', 'medium', 'high', 'auto']).default('medium'),
  GENERATE_DALLE_IMAGES: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  /** If true, paid org plans force AI scene images even when GENERATE_DALLE_IMAGES=false. Default off (cost). */
  FORCE_AI_IMAGES_ON_PAID: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  /** Cap AI scene images per media job (0 = unlimited). Applies when AI images are enabled. */
  MAX_AI_IMAGES_PER_VIDEO: z.coerce.number().int().min(0).max(100).default(4),
  /** YouTube thumbnails are SVG overlays (0 AI cost). Kept for docs/UI; generation always uses 1 variant. */
  THUMBNAIL_VARIANTS: z.coerce.number().int().min(1).max(3).default(1),
  PIPELINE_MAX_SCENES: z.coerce.number().optional(),
  PIPELINE_MIN_SCENES_LONG: z.coerce.number().default(6),
  PIPELINE_MAX_SCENES_SHORT: z.coerce.number().default(3),
  /** Fewer scenes → fewer TTS/image/FFmpeg encodes. Duration still driven by targetDuration*Sec. */
  PIPELINE_MAX_SCENES_LONG: z.coerce.number().default(8),
  OPENAI_MAX_TOKENS: z.coerce.number().default(1000),
  OPENAI_MAX_TOKENS_LONG: z.coerce.number().default(8000),
  API_PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  STORAGE_PATH: z.string().default('./storage'),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_REFRESH_TOKEN: z.string().optional(),
  YOUTUBE_PRIVACY_STATUS: z.enum(['public', 'unlisted', 'private']).default('public'),
  SHORTS_CLIP_MAX_SEC: z.coerce.number().default(60),
  DEFAULT_REVIEW_REQUIRED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  DEFAULT_MIN_VIRAL_SCORE: z.coerce.number().min(0).max(100).default(0),
  IDEA_MAX_RETRIES: z.coerce.number().int().min(1).max(20).default(5),
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

  // YouTube OAuth app (para conectar cuentas por canal desde UI)
  if (!cfg.YOUTUBE_CLIENT_ID?.trim() || !cfg.YOUTUBE_CLIENT_SECRET?.trim()) {
    throw new Error('En producción se exige YOUTUBE_CLIENT_ID y YOUTUBE_CLIENT_SECRET');
  }

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
  generateAiImages: z.union([z.boolean(), z.null()]).optional(),
  edgeTtsVoice: z.union([z.string().min(2).max(120), z.null()]).optional(),
  elevenLabsVoiceId: z.union([z.string().min(2).max(120), z.null()]).optional(),
  openaiTtsVoice: z.union([z.string().min(2).max(120), z.null()]).optional(),
});

export function getIdeaMaxRetries(channelMax?: number): number {
  const config = loadConfig();
  return channelMax ?? config.IDEA_MAX_RETRIES;
}

export type GetMaxScenesOptions = {
  retentionMode?: boolean;
  /** Channel.config.maxScenesLong — wins over org/env for long format. */
  maxScenesLong?: number | null;
};

export function getMaxScenes(
  format: 'shorts' | 'long',
  options?: GetMaxScenesOptions,
): number {
  const config = loadConfig();
  const org = getOrgPipelineOverrides();
  const retention = options?.retentionMode ?? false;
  let max: number;
  if (format === 'long') {
    max = resolveMaxScenesLong({
      channelMaxScenesLong: options?.maxScenesLong,
      orgMaxScenesLong: org?.maxScenesLong,
      envMaxScenesLong: config.PIPELINE_MAX_SCENES_LONG,
      envPipelineMaxScenes: config.PIPELINE_MAX_SCENES,
    });
  } else {
    max =
      config.PIPELINE_MAX_SCENES != null
        ? config.PIPELINE_MAX_SCENES
        : retention
          ? 5
          : config.PIPELINE_MAX_SCENES_SHORT;
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
  return org?.deepseekApiKey?.trim() || loadConfig().DEEPSEEK_API_KEY?.trim() || undefined;
}

function effectiveOpenAiApiKey(options?: { orgOpenAiApiKey?: string | null }): string | undefined {
  const org = getOrgPipelineOverrides();
  return (
    options?.orgOpenAiApiKey?.trim() ||
    org?.openAiApiKey?.trim() ||
    loadConfig().OPENAI_API_KEY?.trim() ||
    undefined
  );
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
 * Config with org pipeline overrides applied (keys, TTS/LLM provider, DALL·E flag, scenes).
 * Use in TTS/media paths so BYOK and UI prefs take effect without rewriting every call site.
 * Channel overrides for scenes/AI images are applied via getMaxScenes / isAiSceneImagesEnabled.
 */
export function loadEffectiveConfig(): AppConfig {
  const base = loadConfig();
  const org = getOrgPipelineOverrides();
  if (!org) return base;

  const llmProvider =
    org.llmProvider === 'deepseek' || org.llmProvider === 'openai' || org.llmProvider === 'auto'
      ? org.llmProvider
      : base.LLM_PROVIDER;

  const ttsProvider =
    org.ttsProvider === 'edge' ||
    org.ttsProvider === 'elevenlabs' ||
    org.ttsProvider === 'openai' ||
    org.ttsProvider === 'auto'
      ? org.ttsProvider
      : base.TTS_PROVIDER;

  return {
    ...base,
    LLM_PROVIDER: llmProvider,
    TTS_PROVIDER: ttsProvider,
    GENERATE_DALLE_IMAGES:
      org.generateAiImages != null ? org.generateAiImages : base.GENERATE_DALLE_IMAGES,
    PIPELINE_MAX_SCENES_LONG:
      typeof org.maxScenesLong === 'number' && org.maxScenesLong > 0
        ? org.maxScenesLong
        : base.PIPELINE_MAX_SCENES_LONG,
    MAX_AI_IMAGES_PER_VIDEO: resolveMaxAiImagesPerVideo({
      orgMaxAiImagesPerVideo: org.maxAiImagesPerVideo,
      envMaxAiImagesPerVideo: base.MAX_AI_IMAGES_PER_VIDEO,
    }),
    OPENAI_IMAGE_QUALITY: resolveImageQuality({
      orgOpenaiImageQuality: org.openaiImageQuality,
      envOpenaiImageQuality: base.OPENAI_IMAGE_QUALITY,
    }),
    EDGE_TTS_VOICE: org.edgeTtsVoice?.trim() || base.EDGE_TTS_VOICE,
    ELEVENLABS_VOICE_ID: org.elevenLabsVoiceId?.trim() || base.ELEVENLABS_VOICE_ID,
    OPENAI_TTS_VOICE: org.openaiTtsVoice?.trim() || base.OPENAI_TTS_VOICE,
    OPENAI_API_KEY: org.openAiApiKey?.trim() || base.OPENAI_API_KEY,
    DEEPSEEK_API_KEY: org.deepseekApiKey?.trim() || base.DEEPSEEK_API_KEY,
    ELEVENLABS_API_KEY: org.elevenLabsApiKey?.trim() || base.ELEVENLABS_API_KEY,
  };
}

/** Whether scene images may use paid AI (DALL·E / gpt-image), ignoring per-video caps. */
export function isAiSceneImagesEnabled(
  orgPlan?: string | null,
  options?: { channelGenerateAiImages?: boolean | null },
): boolean {
  const org = getOrgPipelineOverrides();
  const config = loadConfig();
  return resolveGenerateAiImages({
    channelGenerateAiImages: options?.channelGenerateAiImages,
    orgGenerateAiImages: org?.generateAiImages,
    envGenerateAiImages: config.GENERATE_DALLE_IMAGES,
    forceAiImagesOnPaid: config.FORCE_AI_IMAGES_ON_PAID,
    orgPlan,
  });
}

export function getMinScenes(
  format: 'shorts' | 'long',
  options?: { retentionMode?: boolean },
): number {
  const retention = options?.retentionMode ?? false;
  if (format === 'long') return loadConfig().PIPELINE_MIN_SCENES_LONG;
  return retention ? 4 : 2;
}

export function parseChannelConfig(raw: unknown): ChannelConfig {
  const defaults = loadConfig();
  const parsed = channelConfigSchema.parse({
    reviewRequired: defaults.DEFAULT_REVIEW_REQUIRED,
    autoPublish: !defaults.DEFAULT_REVIEW_REQUIRED,
    minViralScore: defaults.DEFAULT_MIN_VIRAL_SCORE,
    visualSourceMode: 'mixed',
    ...((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>),
  });
  // null = inherit org/env — strip so JSON stays clean
  if (parsed.maxScenesLong == null) delete (parsed as { maxScenesLong?: number | null }).maxScenesLong;
  if (parsed.generateAiImages == null) {
    delete (parsed as { generateAiImages?: boolean | null }).generateAiImages;
  }
  if (parsed.edgeTtsVoice == null) delete (parsed as { edgeTtsVoice?: string | null }).edgeTtsVoice;
  if (parsed.elevenLabsVoiceId == null) {
    delete (parsed as { elevenLabsVoiceId?: string | null }).elevenLabsVoiceId;
  }
  if (parsed.openaiTtsVoice == null) {
    delete (parsed as { openaiTtsVoice?: string | null }).openaiTtsVoice;
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
  mergeChannelVoiceOverrides,
  setOrgPipelineOverrides,
  type OrgImageQuality,
  type OrgLlmProvider,
  type OrgPipelineOverrides,
  type OrgTtsProvider,
} from './org-runtime.js';
export {
  resolveGenerateAiImages,
  resolveImageQuality,
  resolveMaxAiImagesPerVideo,
  resolveMaxScenesLong,
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
