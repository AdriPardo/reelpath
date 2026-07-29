/**
 * Per-request / per-pipeline overrides for an organization.
 * Set by the worker (and optionally API) before running LLM/TTS/media.
 * Platform .env remains the fallback when a field is unset.
 */

export type OrgLlmProvider = 'auto' | 'deepseek' | 'openai';
export type OrgTtsProvider = 'auto' | 'edge' | 'elevenlabs' | 'openai';
export type OrgImageQuality = 'low' | 'medium' | 'high' | 'auto';

export type OrgPipelineOverrides = {
  llmProvider?: OrgLlmProvider | null;
  ttsProvider?: OrgTtsProvider | null;
  generateAiImages?: boolean | null;
  maxScenesLong?: number | null;
  /** Cap AI scene images per video; null = platform MAX_AI_IMAGES_PER_VIDEO. */
  maxAiImagesPerVideo?: number | null;
  /** gpt-image quality; null = platform OPENAI_IMAGE_QUALITY. */
  openaiImageQuality?: OrgImageQuality | null;
  /** Edge voice id; null = EDGE_TTS_VOICE. */
  edgeTtsVoice?: string | null;
  /** ElevenLabs voice id; null = ELEVENLABS_VOICE_ID. */
  elevenLabsVoiceId?: string | null;
  /** OpenAI TTS voice; null = OPENAI_TTS_VOICE. */
  openaiTtsVoice?: string | null;
  /** BYOK OpenAI only (not the platform env key). */
  openAiApiKey?: string | null;
  /** BYOK DeepSeek only. */
  deepseekApiKey?: string | null;
  /** BYOK ElevenLabs only. */
  elevenLabsApiKey?: string | null;
};

let orgOverrides: OrgPipelineOverrides | null = null;

export function setOrgPipelineOverrides(overrides: OrgPipelineOverrides | null): void {
  orgOverrides = overrides;
}

export function clearOrgPipelineOverrides(): void {
  orgOverrides = null;
}

export function getOrgPipelineOverrides(): OrgPipelineOverrides | null {
  return orgOverrides;
}

/**
 * Merge channel TTS voice overrides on top of org overrides (channel > org > env).
 * Empty/null channel fields keep the org value.
 */
export function mergeChannelVoiceOverrides(
  org: OrgPipelineOverrides | null,
  channel: {
    edgeTtsVoice?: string | null;
    elevenLabsVoiceId?: string | null;
    openaiTtsVoice?: string | null;
  },
): OrgPipelineOverrides {
  const base: OrgPipelineOverrides = { ...(org ?? {}) };
  const edge = channel.edgeTtsVoice?.trim();
  const eleven = channel.elevenLabsVoiceId?.trim();
  const openai = channel.openaiTtsVoice?.trim();
  if (edge) base.edgeTtsVoice = edge;
  if (eleven) base.elevenLabsVoiceId = eleven;
  if (openai) base.openaiTtsVoice = openai;
  return base;
}
