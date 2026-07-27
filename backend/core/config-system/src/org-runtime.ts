/**
 * Per-request / per-pipeline overrides for an organization.
 * Set by the worker (and optionally API) before running LLM/TTS/media.
 * Platform .env remains the fallback when a field is unset.
 */

export type OrgLlmProvider = 'auto' | 'deepseek' | 'openai';
export type OrgTtsProvider = 'auto' | 'edge' | 'elevenlabs' | 'openai';

export type OrgPipelineOverrides = {
  llmProvider?: OrgLlmProvider | null;
  ttsProvider?: OrgTtsProvider | null;
  generateAiImages?: boolean | null;
  maxScenesLong?: number | null;
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
