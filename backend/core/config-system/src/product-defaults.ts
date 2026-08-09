/**
 * Product defaults (not .env). Hierarchy: channel → organization → these values.
 * Infra/secrets stay in process.env via loadConfig().
 */

export type ProductImageQuality = 'low' | 'medium' | 'high' | 'auto';
export type ProductTtsProvider = 'auto' | 'edge' | 'elevenlabs' | 'openai';

export const PRODUCT_DEFAULTS = {
  reviewRequired: false,
  minViralScore: 0,
  generateAiImages: false,
  maxAiImagesPerVideo: 4,
  openaiImageQuality: 'medium' as ProductImageQuality,
  /** auto = Flux Pro (fal) first, then OpenAI gpt-image. */
  imageAiProvider: 'auto' as 'auto' | 'fal' | 'openai',
  falImageModel: 'fal-ai/flux-pro/v1.1',
  maxScenesLong: 8,
  minScenesLong: 6,
  maxScenesShort: 3,
  shortsClipMaxSec: 60,
  ttsProvider: 'auto' as ProductTtsProvider,
  edgeTtsVoice: 'es-ES-ElviraNeural',
  elevenLabsVoiceId: 'XrExE9yKIg1WjnnlVkGX',
  openaiTtsVoice: 'nova',
  llmProvider: 'auto' as const,
  openaiTtsModel: 'tts-1',
  openaiTtsSpeed: 1,
  openaiImageModel: 'gpt-image-1',
  edgeTtsRate: '+0%',
  edgeTtsVolume: '+0%',
  edgeTtsPitch: '+0Hz',
  elevenLabsModel: 'eleven_multilingual_v2',
  elevenLabsOutputFormat: 'mp3_44100_128',
  elevenLabsLanguageCode: 'es',
  elevenLabsStability: 0.45,
  elevenLabsSimilarity: 0.8,
  elevenLabsStyle: 0.15,
  deepseekModel: 'deepseek-v4-pro',
  openaiModel: 'gpt-4o-mini',
  openaiMaxTokens: 3000,
  openaiMaxTokensLong: 8000,
  ideaMaxRetries: 5,
} as const;
