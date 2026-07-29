import { describe, expect, it } from 'vitest';
import {
  resolveGenerateAiImages,
  resolveImageQuality,
  resolveMaxAiImagesPerVideo,
  resolveMaxScenesLong,
} from './resolve-settings.js';

describe('resolveMaxScenesLong (channel > org > env)', () => {
  it('uses channel when set', () => {
    expect(
      resolveMaxScenesLong({
        channelMaxScenesLong: 12,
        orgMaxScenesLong: 8,
        envMaxScenesLong: 6,
      }),
    ).toBe(12);
  });

  it('falls back to org then env', () => {
    expect(
      resolveMaxScenesLong({
        channelMaxScenesLong: null,
        orgMaxScenesLong: 10,
        envMaxScenesLong: 6,
      }),
    ).toBe(10);
    expect(
      resolveMaxScenesLong({
        orgMaxScenesLong: null,
        envMaxScenesLong: 6,
      }),
    ).toBe(6);
  });

  it('honors absolute PIPELINE_MAX_SCENES env override', () => {
    expect(
      resolveMaxScenesLong({
        channelMaxScenesLong: 12,
        orgMaxScenesLong: 10,
        envMaxScenesLong: 8,
        envPipelineMaxScenes: 5,
      }),
    ).toBe(5);
  });
});

describe('resolveGenerateAiImages (channel > org > env)', () => {
  it('uses channel boolean when set', () => {
    expect(
      resolveGenerateAiImages({
        channelGenerateAiImages: false,
        orgGenerateAiImages: true,
        envGenerateAiImages: true,
        forceAiImagesOnPaid: true,
        orgPlan: 'pro',
      }),
    ).toBe(false);
    expect(
      resolveGenerateAiImages({
        channelGenerateAiImages: true,
        orgGenerateAiImages: false,
        envGenerateAiImages: false,
        forceAiImagesOnPaid: false,
      }),
    ).toBe(true);
  });

  it('falls back to org then env / paid force', () => {
    expect(
      resolveGenerateAiImages({
        orgGenerateAiImages: true,
        envGenerateAiImages: false,
        forceAiImagesOnPaid: false,
      }),
    ).toBe(true);
    expect(
      resolveGenerateAiImages({
        envGenerateAiImages: false,
        forceAiImagesOnPaid: true,
        orgPlan: 'starter',
      }),
    ).toBe(true);
    expect(
      resolveGenerateAiImages({
        envGenerateAiImages: false,
        forceAiImagesOnPaid: true,
        orgPlan: 'trial',
      }),
    ).toBe(false);
  });
});

describe('resolveMaxAiImagesPerVideo / resolveImageQuality', () => {
  it('resolves org over env for image caps', () => {
    expect(
      resolveMaxAiImagesPerVideo({
        orgMaxAiImagesPerVideo: 2,
        envMaxAiImagesPerVideo: 4,
      }),
    ).toBe(2);
    expect(
      resolveMaxAiImagesPerVideo({
        orgMaxAiImagesPerVideo: null,
        envMaxAiImagesPerVideo: 4,
      }),
    ).toBe(4);
  });

  it('resolves image quality org over env', () => {
    expect(
      resolveImageQuality({
        orgOpenaiImageQuality: 'high',
        envOpenaiImageQuality: 'medium',
      }),
    ).toBe('high');
    expect(
      resolveImageQuality({
        orgOpenaiImageQuality: null,
        envOpenaiImageQuality: 'medium',
      }),
    ).toBe('medium');
    expect(
      resolveImageQuality({
        orgOpenaiImageQuality: 'nope',
        envOpenaiImageQuality: 'low',
      }),
    ).toBe('low');
  });
});
