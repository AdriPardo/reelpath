/**
 * Product preference resolution: channel > org > code default.
 * Infra (FFmpeg, worker concurrency, auth, DB, API keys) stays in .env only.
 */

import { PRODUCT_DEFAULTS, type ProductImageQuality } from './product-defaults.js';

export type ResolveMaxScenesLongInput = {
  channelMaxScenesLong?: number | null;
  orgMaxScenesLong?: number | null;
  /** @deprecated ignored — use code default */
  codeDefault?: number;
};

export function resolveMaxScenesLong(input: ResolveMaxScenesLongInput): number {
  const channel = input.channelMaxScenesLong;
  if (typeof channel === 'number' && Number.isFinite(channel) && channel > 0) {
    return Math.floor(channel);
  }
  const org = input.orgMaxScenesLong;
  if (typeof org === 'number' && Number.isFinite(org) && org > 0) {
    return Math.floor(org);
  }
  return Math.max(1, Math.floor(input.codeDefault ?? PRODUCT_DEFAULTS.maxScenesLong));
}

export type ResolveGenerateAiImagesInput = {
  channelGenerateAiImages?: boolean | null;
  orgGenerateAiImages?: boolean | null;
  /** @deprecated ignored — use code default */
  codeDefault?: boolean;
};

/**
 * Whether paid AI scene images may be used (before visualSourceMode / per-video caps).
 */
export function resolveGenerateAiImages(input: ResolveGenerateAiImagesInput): boolean {
  if (input.channelGenerateAiImages === true || input.channelGenerateAiImages === false) {
    return input.channelGenerateAiImages;
  }
  if (input.orgGenerateAiImages === true || input.orgGenerateAiImages === false) {
    return input.orgGenerateAiImages;
  }
  return input.codeDefault ?? PRODUCT_DEFAULTS.generateAiImages;
}

export type ResolveMaxAiImagesPerVideoInput = {
  channelMaxAiImagesPerVideo?: number | null;
  orgMaxAiImagesPerVideo?: number | null;
  codeDefault?: number;
};

/** 0 = unlimited. */
export function resolveMaxAiImagesPerVideo(input: ResolveMaxAiImagesPerVideoInput): number {
  const channel = input.channelMaxAiImagesPerVideo;
  if (typeof channel === 'number' && Number.isFinite(channel) && channel >= 0) {
    return Math.floor(channel);
  }
  const org = input.orgMaxAiImagesPerVideo;
  if (typeof org === 'number' && Number.isFinite(org) && org >= 0) {
    return Math.floor(org);
  }
  return Math.max(0, Math.floor(input.codeDefault ?? PRODUCT_DEFAULTS.maxAiImagesPerVideo));
}

const IMAGE_QUALITIES = new Set<ProductImageQuality>(['low', 'medium', 'high', 'auto']);

export type ResolveImageQualityInput = {
  channelOpenaiImageQuality?: string | null;
  orgOpenaiImageQuality?: string | null;
  codeDefault?: ProductImageQuality;
};

export function resolveImageQuality(input: ResolveImageQualityInput): ProductImageQuality {
  const channel = input.channelOpenaiImageQuality?.trim();
  if (channel && IMAGE_QUALITIES.has(channel as ProductImageQuality)) {
    return channel as ProductImageQuality;
  }
  const org = input.orgOpenaiImageQuality?.trim();
  if (org && IMAGE_QUALITIES.has(org as ProductImageQuality)) {
    return org as ProductImageQuality;
  }
  return input.codeDefault ?? PRODUCT_DEFAULTS.openaiImageQuality;
}

export type ResolveMinScenesLongInput = {
  channelMinScenesLong?: number | null;
  orgMinScenesLong?: number | null;
  codeDefault?: number;
};

export function resolveMinScenesLong(input: ResolveMinScenesLongInput): number {
  const channel = input.channelMinScenesLong;
  if (typeof channel === 'number' && Number.isFinite(channel) && channel > 0) {
    return Math.floor(channel);
  }
  const org = input.orgMinScenesLong;
  if (typeof org === 'number' && Number.isFinite(org) && org > 0) {
    return Math.floor(org);
  }
  return Math.max(1, Math.floor(input.codeDefault ?? PRODUCT_DEFAULTS.minScenesLong));
}

export type ResolveMaxScenesShortInput = {
  channelMaxScenesShort?: number | null;
  codeDefault?: number;
};

export function resolveMaxScenesShort(input: ResolveMaxScenesShortInput): number {
  const channel = input.channelMaxScenesShort;
  if (typeof channel === 'number' && Number.isFinite(channel) && channel > 0) {
    return Math.floor(channel);
  }
  return Math.max(1, Math.floor(input.codeDefault ?? PRODUCT_DEFAULTS.maxScenesShort));
}

export type ResolveTtsProviderInput = {
  channelTtsProvider?: string | null;
  orgTtsProvider?: string | null;
  codeDefault?: string;
};

const TTS_PROVIDERS = new Set(['auto', 'edge', 'elevenlabs', 'openai', 'mock']);

export function resolveTtsProvider(
  input: ResolveTtsProviderInput,
): 'auto' | 'edge' | 'elevenlabs' | 'openai' | 'mock' {
  const channel = input.channelTtsProvider?.trim();
  if (channel && TTS_PROVIDERS.has(channel)) {
    return channel as 'auto' | 'edge' | 'elevenlabs' | 'openai' | 'mock';
  }
  const org = input.orgTtsProvider?.trim();
  if (org && TTS_PROVIDERS.has(org)) {
    return org as 'auto' | 'edge' | 'elevenlabs' | 'openai' | 'mock';
  }
  const fallback = input.codeDefault ?? PRODUCT_DEFAULTS.ttsProvider;
  return TTS_PROVIDERS.has(fallback)
    ? (fallback as 'auto' | 'edge' | 'elevenlabs' | 'openai' | 'mock')
    : 'auto';
}
