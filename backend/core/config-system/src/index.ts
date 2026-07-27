import { z } from 'zod';
import type { ChannelConfig } from '@autotube/shared';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  // TTS provider priority (TTS_PROVIDER=auto): ElevenLabs → Edge (free) → OpenAI → mock
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
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MODEL_DEV: z.string().default('gpt-4o-mini'),
  SCRIPT_DEV_MODE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  OPENAI_TTS_VOICE: z.string().default('nova'),
  OPENAI_TTS_MODEL: z.string().default('tts-1-hd'),
  OPENAI_TTS_SPEED: z.coerce.number().min(0.25).max(4).default(1),
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-1'),
  GENERATE_DALLE_IMAGES: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  PIPELINE_MAX_SCENES: z.coerce.number().optional(),
  PIPELINE_MIN_SCENES_LONG: z.coerce.number().default(12),
  PIPELINE_MAX_SCENES_SHORT: z.coerce.number().default(3),
  PIPELINE_MAX_SCENES_LONG: z.coerce.number().default(20),
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

  const useMocks =
    parsed.data.MOCK_EXTERNAL_APIS || (!parsed.data.OPENAI_API_KEY && !hasRealTts);

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
});

export function getIdeaMaxRetries(channelMax?: number): number {
  const config = loadConfig();
  return channelMax ?? config.IDEA_MAX_RETRIES;
}

export function getMaxScenes(
  format: 'shorts' | 'long',
  options?: { retentionMode?: boolean },
): number {
  const config = loadConfig();
  const retention = options?.retentionMode ?? false;
  let max: number;
  if (config.PIPELINE_MAX_SCENES != null) max = config.PIPELINE_MAX_SCENES;
  else if (format === 'long') max = config.PIPELINE_MAX_SCENES_LONG;
  else max = retention ? 5 : config.PIPELINE_MAX_SCENES_SHORT;
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

export function getOpenAiModel(): string {
  const config = loadConfig();
  if (isScriptDevMode() && config.OPENAI_MODEL_DEV) {
    return config.OPENAI_MODEL_DEV;
  }
  return config.OPENAI_MODEL;
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
  return channelConfigSchema.parse({
    reviewRequired: defaults.DEFAULT_REVIEW_REQUIRED,
    autoPublish: !defaults.DEFAULT_REVIEW_REQUIRED,
    minViralScore: defaults.DEFAULT_MIN_VIRAL_SCORE,
    visualSourceMode: 'mixed',
    ...((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>),
  });
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
