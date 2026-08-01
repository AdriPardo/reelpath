export type VideoFormat = 'shorts' | 'long';
export type AspectRatio = '9:16' | '16:9';
export type MotionPreset =
  | 'push-in'
  | 'pull-out'
  | 'pan-left'
  | 'pan-right'
  | 'drift-up'
  | 'drift-down';
export type TransitionPreset =
  | 'fade'
  | 'dip-to-black'
  | 'slide-left'
  | 'slide-right'
  | 'blur';
export type VideoMotionIntensity = 'subtle' | 'normal' | 'dynamic';
export type VisualSource = 'image' | 'stock';
/** Fuente visual por defecto del canal: IA, stock B-roll o alternancia. */
export type VisualSourceMode = 'image' | 'stock' | 'mixed';
export type PipelineStatus =
  | 'scheduled'
  | 'generating_ideas'
  | 'selecting_idea'
  | 'generating_script'
  | 'generating_media'
  | 'rendering_video'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'publishing'
  | 'published'
  | 'syncing_analytics'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type PromptType =
  | 'idea_generation'
  | 'script_generation'
  | 'hook_ab'
  | 'title_seo'
  | 'description_seo'
  | 'content_review';

export type MediaAssetType = 'audio' | 'image' | 'subtitle' | 'video';

export interface ChannelConfig {
  niche: string;
  videoFormat: VideoFormat;
  aspectRatio: AspectRatio;
  templateId: string;
  autoPublish: boolean;
  reviewRequired: boolean;
  ideasPerRun: number;
  language: string;
  /** Display / brand name override for prompts and metadata. */
  brandName?: string;
  /** Narrative tone (e.g. documental, casual, educativo). */
  tone?: string;
  /** Primary audience description for idea/script generation. */
  targetAudience?: string;
  /** Topics the channel must never cover. */
  forbiddenTopics?: string[];
  /** Extra hints injected into LLM prompts for this channel. */
  customPromptHints?: string;
  /** Optional disclaimer appended to descriptions. */
  contentDisclaimer?: string;
  /** Publish full video to YouTube after approval (default true). */
  publishYoutube?: boolean;
  /** Upload vertical clips as YouTube Shorts (long format) or mark main upload as Short (shorts format). */
  publishYoutubeShorts?: boolean;
  /** Max seconds per vertical Short part when splitting a long video (default 60). */
  shortsClipMaxSec?: number;
  /** Minimum viral score to accept an idea (0 = no filter, pick best). */
  minViralScore?: number;
  /** Max idea regenerations when minViralScore is not met. */
  maxIdeaRetries?: number;
  /** Target minimum duration for long-form videos in seconds (default 480 = 8 min). */
  targetDurationMinSec?: number;
  /** Target maximum duration for long-form videos in seconds (default 900 = 15 min). */
  targetDurationMaxSec?: number;
  /** Stricter hooks, faster pacing, and denser subtitles for watch retention. */
  retentionMode?: boolean;
  /** Run an automated quality review (QA) on the rendered video before it reaches the review queue. */
  autoReview?: boolean;
  /** Auto-approve (skip human review) when the quality score reaches this threshold (0-100). */
  autoApproveMinScore?: number;
  /** How vertical Shorts are produced from long videos: split, dedicated teasers, or mixed (1 cut + teasers). */
  shortsMode?: 'split' | 'dedicated' | 'mixed';
  /** Shorts por vídeo largo (1-7). En dedicated/mixed: teasers dedicados; en mixed el total incluye cortes del largo. */
  shortsPerVideo?: number;
  /** Cuántas partes del vídeo largo se convierten en Shorts (1-3). En mixed resto = teasers; en split limita partes distribuidas. */
  longShortsFromVideo?: number;
  /** Días entre Shorts consecutivos al programar su publicación escalonada (0 = todos ya; default 1). */
  shortsPublishIntervalDays?: number;
  /** Zona horaria IANA para programación (default Europe/Madrid). */
  timezone?: string;
  /** Activa el planificador automático de publicación. */
  publishPlannerEnabled?: boolean;
  /** Máximo de vídeos largos por semana ISO (default 1). */
  maxLongsPerWeek?: number;
  /** Hora preferida para vídeos largos, 0-23 en timezone del canal (default 19). */
  preferredPublishHour?: number;
  /** Días preferidos para largos: 0=dom … 6=sáb (default [5] viernes). */
  preferredPublishDays?: number[];
  /** Mínimo de días entre vídeos largos (default derivado de maxLongsPerWeek). */
  minDaysBetweenLongs?: number;
  /** Horarios preferidos para Shorts extra (default 12:30 y 19:00). */
  shortPreferredSlots?: Array<{ hour: number; minute: number }>;
  /** Genera pipelines solos según días del planificador (con margen). */
  autoGenerateEnabled?: boolean;
  /** Días de antelación respecto al slot de publicación (0–3, default 1). */
  autoGenerateLeadDays?: number;
  /** Guion monolítico (1 llamada) o por bloques (outline + chunks). Default: chunked para long. */
  scriptGenerationMode?: 'monolithic' | 'chunked';
  /** Intensidad global del Ken Burns / motion por escena (default normal). */
  videoMotionIntensity?: VideoMotionIntensity;
  /** Fuente visual por defecto: imágenes IA, clips stock o mixto (default image). */
  visualSourceMode?: VisualSourceMode;
  /**
   * Tope de escenas en vídeos largos (override canal).
   * undefined/null = heredar Organization.maxScenesLong → default de código.
   */
  maxScenesLong?: number | null;
  /** Mínimo de escenas long; null = heredar org → código. */
  minScenesLong?: number | null;
  /** Máx. escenas short; null = heredar → código. */
  maxScenesShort?: number | null;
  /**
   * Imágenes IA de escena (override canal).
   * undefined/null = heredar Organization.generateAiImages → default de código.
   */
  generateAiImages?: boolean | null;
  /** Tope de imágenes IA por vídeo; null = heredar org → código. */
  maxAiImagesPerVideo?: number | null;
  /** Calidad gpt-image; null = heredar org → código. */
  openaiImageQuality?: 'low' | 'medium' | 'high' | 'auto' | null;
  /** Proveedor TTS; null = heredar org → código. */
  ttsProvider?: 'auto' | 'edge' | 'elevenlabs' | 'openai' | null;
  /**
   * Voz Edge TTS (override canal).
   * undefined/null = heredar Organization.edgeTtsVoice → default de código.
   */
  edgeTtsVoice?: string | null;
  /**
   * Voice ID ElevenLabs (override canal).
   * undefined/null = heredar Organization.elevenLabsVoiceId → default de código.
   */
  elevenLabsVoiceId?: string | null;
  /**
   * Voz OpenAI TTS (override canal).
   * undefined/null = heredar Organization.openaiTtsVoice → default de código.
   */
  openaiTtsVoice?: string | null;
}

export type VideoQualityCheckStatus = 'pass' | 'warn' | 'fail';

export interface VideoQualityCheck {
  id: string;
  label: string;
  status: VideoQualityCheckStatus;
  detail: string;
}

export interface VideoQualityReport {
  score: number;
  /** No fail-level checks: the video is safe to publish. */
  passed: boolean;
  /** Passed AND score >= channel threshold: eligible for auto-approval. */
  autoApproved: boolean;
  checks: VideoQualityCheck[];
  generatedAt: string;
}

export interface VideoIdeaDTO {
  title: string;
  hook: string;
  angle: string;
  targetAudience: string;
  trendAlignment: number;
  viralScore: number;
  rationale: string;
}

export interface ScriptScene {
  index: number;
  narration: string;
  visualPrompt: string;
  durationSec: number;
  /** Preferencia de origen visual por escena (stock → clip Pexels, fallback imagen IA). */
  preferredVisualSource?: VisualSource;
  /** Transición visual hacia la escena siguiente (si el guion la define). */
  transitionPreset?: TransitionPreset;
}

export interface ScriptVariant {
  variantId: string;
  hook: string;
  hookVariant: 'A' | 'B';
  scenes: ScriptScene[];
  estimatedDurationSec: number;
}

export interface ScriptDTO {
  title: string;
  description: string;
  tags: string[];
  selectedVariant: ScriptVariant;
  alternateVariant?: ScriptVariant;
}

export interface MediaAssetDTO {
  sceneIndex: number;
  type: MediaAssetType;
  path: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineClip {
  sceneIndex: number;
  startSec: number;
  durationSec: number;
  narration?: string;
  imagePath?: string;
  /** Clip de stock B-roll (MP4) cuando preferredVisualSource es stock. */
  videoPath?: string;
  audioPath?: string;
  subtitlePath?: string;
  motionPreset?: MotionPreset;
  motionIntensity?: VideoMotionIntensity;
  transitionToNext?: TransitionPreset;
  preferredVisualSource?: VisualSource;
}

export interface VideoTemplate {
  id: string;
  name: string;
  aspectRatio: AspectRatio;
  fps: number;
  resolution: { width: number; height: number };
  backgroundColor: string;
  subtitleStyle: {
    fontSize: number;
    fontColor: string;
    position: 'bottom' | 'center';
  };
  transitions: 'cut' | 'fade';
  /** Grano de película ligero vía FFmpeg noise (bajo coste). */
  filmGrain?: boolean;
  /** Viñeta suave en bordes del encuadre. */
  vignette?: boolean;
}

export interface ContentScoreBreakdown {
  hookStrength: number;
  trendAlignment: number;
  nicheFit: number;
  seoPotential: number;
  total: number;
}

export interface PipelineJobPayload {
  pipelineRunId: string;
  channelId: string;
  step?: string;
  /** Republicar solo el vídeo de YouTube (sin regenerar Shorts). */
  youtubeOnly?: boolean;
  /** Generar clips verticales para Shorts antes de la revisión, sin publicar. */
  splitOnly?: boolean;
  /** Solo reintentar subida de YouTube Shorts (respeta scheduledPublishAt de cada clip). */
  shortsOnly?: boolean;
}

export const QUEUE_NAMES = {
  PIPELINE: 'autotube-pipeline',
  MEDIA: 'autotube-media',
  RENDER: 'autotube-render',
  PUBLISH: 'autotube-publish',
  ANALYTICS: 'autotube-analytics',
  MAINTENANCE: 'autotube-maintenance',
} as const;

export const PIPELINE_STEPS = [
  'generate_ideas',
  'select_idea',
  'generate_script',
  'generate_media',
  'render_video',
  'auto_review',
  'await_review',
  'publish',
  'split_shorts',
  'generate_short',
  'publish_youtube_shorts',
  'sync_analytics',
  'optimize_prompts',
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number];
