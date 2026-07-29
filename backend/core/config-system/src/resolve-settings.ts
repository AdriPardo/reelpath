/**
 * Product preference resolution: channel > org > env > code default.
 * Infra (FFmpeg, worker concurrency, auth, DB) stays in .env only.
 */

import type { OrgImageQuality } from './org-runtime.js';

export type ResolveMaxScenesLongInput = {
  /** Channel.config.maxScenesLong */
  channelMaxScenesLong?: number | null;
  /** Organization.maxScenesLong */
  orgMaxScenesLong?: number | null;
  /** env PIPELINE_MAX_SCENES_LONG */
  envMaxScenesLong: number;
  /** Absolute platform override PIPELINE_MAX_SCENES (all formats). */
  envPipelineMaxScenes?: number | null;
};

export function resolveMaxScenesLong(input: ResolveMaxScenesLongInput): number {
  if (input.envPipelineMaxScenes != null && Number.isFinite(input.envPipelineMaxScenes)) {
    return Math.max(1, Math.floor(input.envPipelineMaxScenes));
  }
  const channel = input.channelMaxScenesLong;
  if (typeof channel === 'number' && Number.isFinite(channel) && channel > 0) {
    return Math.floor(channel);
  }
  const org = input.orgMaxScenesLong;
  if (typeof org === 'number' && Number.isFinite(org) && org > 0) {
    return Math.floor(org);
  }
  return Math.max(1, Math.floor(input.envMaxScenesLong));
}

export type ResolveGenerateAiImagesInput = {
  /** Channel.config.generateAiImages — undefined = inherit */
  channelGenerateAiImages?: boolean | null;
  /** Organization.generateAiImages */
  orgGenerateAiImages?: boolean | null;
  /** env GENERATE_DALLE_IMAGES */
  envGenerateAiImages: boolean;
  /** env FORCE_AI_IMAGES_ON_PAID */
  forceAiImagesOnPaid: boolean;
  orgPlan?: string | null;
};

/**
 * Whether paid AI scene images may be used (before visualSourceMode / per-video caps).
 * Channel boolean wins when set; else org; else env (+ paid-plan force).
 */
export function resolveGenerateAiImages(input: ResolveGenerateAiImagesInput): boolean {
  if (input.channelGenerateAiImages === true || input.channelGenerateAiImages === false) {
    return input.channelGenerateAiImages;
  }
  if (input.orgGenerateAiImages === true || input.orgGenerateAiImages === false) {
    return input.orgGenerateAiImages;
  }
  if (input.envGenerateAiImages) return true;
  if (!input.forceAiImagesOnPaid) return false;
  return ['starter', 'pro', 'unlimited'].includes(input.orgPlan ?? '');
}

export type ResolveMaxAiImagesPerVideoInput = {
  orgMaxAiImagesPerVideo?: number | null;
  envMaxAiImagesPerVideo: number;
};

/** 0 = unlimited. */
export function resolveMaxAiImagesPerVideo(input: ResolveMaxAiImagesPerVideoInput): number {
  const org = input.orgMaxAiImagesPerVideo;
  if (typeof org === 'number' && Number.isFinite(org) && org >= 0) {
    return Math.floor(org);
  }
  return Math.max(0, Math.floor(input.envMaxAiImagesPerVideo));
}

const IMAGE_QUALITIES = new Set<OrgImageQuality>(['low', 'medium', 'high', 'auto']);

export type ResolveImageQualityInput = {
  orgOpenaiImageQuality?: string | null;
  envOpenaiImageQuality: OrgImageQuality;
};

export function resolveImageQuality(input: ResolveImageQualityInput): OrgImageQuality {
  const org = input.orgOpenaiImageQuality?.trim();
  if (org && IMAGE_QUALITIES.has(org as OrgImageQuality)) {
    return org as OrgImageQuality;
  }
  return input.envOpenaiImageQuality;
}
