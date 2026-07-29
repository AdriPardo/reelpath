/**
 * Per-request / per-pipeline overrides for an organization (+ channel merges).
 * Set by the worker (and optionally API) before running LLM/TTS/media.
 * Product fallbacks are code defaults (product-defaults.ts), not .env.
 */

export type OrgLlmProvider = 'auto' | 'deepseek' | 'openai';
export type OrgTtsProvider = 'auto' | 'edge' | 'elevenlabs' | 'openai';
export type OrgImageQuality = 'low' | 'medium' | 'high' | 'auto';

export type OrgPipelineOverrides = {
  llmProvider?: OrgLlmProvider | null;
  ttsProvider?: OrgTtsProvider | null;
  generateAiImages?: boolean | null;
  maxScenesLong?: number | null;
  minScenesLong?: number | null;
  maxScenesShort?: number | null;
  /** Cap AI scene images per video; null = inherit. */
  maxAiImagesPerVideo?: number | null;
  /** gpt-image quality; null = inherit. */
  openaiImageQuality?: OrgImageQuality | null;
  edgeTtsVoice?: string | null;
  elevenLabsVoiceId?: string | null;
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

export type ChannelProductOverrides = {
  ttsProvider?: string | null;
  maxScenesLong?: number | null;
  minScenesLong?: number | null;
  maxScenesShort?: number | null;
  generateAiImages?: boolean | null;
  maxAiImagesPerVideo?: number | null;
  openaiImageQuality?: string | null;
  edgeTtsVoice?: string | null;
  elevenLabsVoiceId?: string | null;
  openaiTtsVoice?: string | null;
};

/**
 * Merge channel product overrides on top of org overrides (channel > org > code).
 * Empty/null channel fields keep the org value.
 */
export function mergeChannelProductOverrides(
  org: OrgPipelineOverrides | null,
  channel: ChannelProductOverrides,
): OrgPipelineOverrides {
  const base: OrgPipelineOverrides = { ...(org ?? {}) };

  const tts = channel.ttsProvider?.trim();
  if (tts === 'auto' || tts === 'edge' || tts === 'elevenlabs' || tts === 'openai') {
    base.ttsProvider = tts;
  }

  if (typeof channel.maxScenesLong === 'number' && channel.maxScenesLong > 0) {
    base.maxScenesLong = channel.maxScenesLong;
  }
  if (typeof channel.minScenesLong === 'number' && channel.minScenesLong > 0) {
    base.minScenesLong = channel.minScenesLong;
  }
  if (typeof channel.maxScenesShort === 'number' && channel.maxScenesShort > 0) {
    base.maxScenesShort = channel.maxScenesShort;
  }
  if (channel.generateAiImages === true || channel.generateAiImages === false) {
    base.generateAiImages = channel.generateAiImages;
  }
  if (typeof channel.maxAiImagesPerVideo === 'number' && channel.maxAiImagesPerVideo >= 0) {
    base.maxAiImagesPerVideo = channel.maxAiImagesPerVideo;
  }
  const quality = channel.openaiImageQuality?.trim();
  if (quality === 'low' || quality === 'medium' || quality === 'high' || quality === 'auto') {
    base.openaiImageQuality = quality;
  }

  const edge = channel.edgeTtsVoice?.trim();
  const eleven = channel.elevenLabsVoiceId?.trim();
  const openai = channel.openaiTtsVoice?.trim();
  if (edge) base.edgeTtsVoice = edge;
  if (eleven) base.elevenLabsVoiceId = eleven;
  if (openai) base.openaiTtsVoice = openai;

  return base;
}

/** @deprecated use mergeChannelProductOverrides */
export function mergeChannelVoiceOverrides(
  org: OrgPipelineOverrides | null,
  channel: ChannelProductOverrides,
): OrgPipelineOverrides {
  return mergeChannelProductOverrides(org, channel);
}
