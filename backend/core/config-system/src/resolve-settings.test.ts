import { describe, expect, it } from 'vitest';
import {
  resolveGenerateAiImages,
  resolveImageQuality,
  resolveMaxAiImagesPerVideo,
  resolveMaxScenesLong,
  resolveMaxScenesShort,
  resolveMinScenesLong,
  resolveTtsProvider,
} from './resolve-settings.js';

describe('resolveMaxScenesLong (channel > org > code)', () => {
  it('uses channel when set', () => {
    expect(
      resolveMaxScenesLong({
        channelMaxScenesLong: 12,
        orgMaxScenesLong: 8,
        codeDefault: 6,
      }),
    ).toBe(12);
  });

  it('falls back to org then code default', () => {
    expect(
      resolveMaxScenesLong({
        channelMaxScenesLong: null,
        orgMaxScenesLong: 10,
        codeDefault: 6,
      }),
    ).toBe(10);
    expect(
      resolveMaxScenesLong({
        orgMaxScenesLong: null,
        codeDefault: 6,
      }),
    ).toBe(6);
  });

  it('ignores legacy absolute env override (removed)', () => {
    expect(
      resolveMaxScenesLong({
        channelMaxScenesLong: 12,
        orgMaxScenesLong: 10,
        codeDefault: 8,
      }),
    ).toBe(12);
  });
});

describe('resolveGenerateAiImages (channel > org > code)', () => {
  it('uses channel boolean when set', () => {
    expect(
      resolveGenerateAiImages({
        channelGenerateAiImages: false,
        orgGenerateAiImages: true,
        codeDefault: true,
      }),
    ).toBe(false);
    expect(
      resolveGenerateAiImages({
        channelGenerateAiImages: true,
        orgGenerateAiImages: false,
        codeDefault: false,
      }),
    ).toBe(true);
  });

  it('falls back to org then code', () => {
    expect(
      resolveGenerateAiImages({
        orgGenerateAiImages: true,
        codeDefault: false,
      }),
    ).toBe(true);
    expect(
      resolveGenerateAiImages({
        codeDefault: false,
      }),
    ).toBe(false);
  });
});

describe('resolveMaxAiImagesPerVideo / resolveImageQuality (channel > org > code)', () => {
  it('resolves channel over org over code for image caps', () => {
    expect(
      resolveMaxAiImagesPerVideo({
        channelMaxAiImagesPerVideo: 1,
        orgMaxAiImagesPerVideo: 2,
        codeDefault: 4,
      }),
    ).toBe(1);
    expect(
      resolveMaxAiImagesPerVideo({
        orgMaxAiImagesPerVideo: 2,
        codeDefault: 4,
      }),
    ).toBe(2);
    expect(
      resolveMaxAiImagesPerVideo({
        orgMaxAiImagesPerVideo: null,
        codeDefault: 4,
      }),
    ).toBe(4);
  });

  it('resolves image quality channel > org > code', () => {
    expect(
      resolveImageQuality({
        channelOpenaiImageQuality: 'low',
        orgOpenaiImageQuality: 'high',
        codeDefault: 'medium',
      }),
    ).toBe('low');
    expect(
      resolveImageQuality({
        orgOpenaiImageQuality: 'high',
        codeDefault: 'medium',
      }),
    ).toBe('high');
    expect(
      resolveImageQuality({
        orgOpenaiImageQuality: 'nope',
        codeDefault: 'medium',
      }),
    ).toBe('medium');
  });
});

describe('resolveMinScenesLong / resolveMaxScenesShort / resolveTtsProvider', () => {
  it('resolves scene mins/max shorts', () => {
    expect(resolveMinScenesLong({ channelMinScenesLong: 7, codeDefault: 6 })).toBe(7);
    expect(resolveMinScenesLong({ orgMinScenesLong: 5, codeDefault: 6 })).toBe(5);
    expect(resolveMaxScenesShort({ channelMaxScenesShort: 4, codeDefault: 3 })).toBe(4);
    expect(resolveMaxScenesShort({ codeDefault: 3 })).toBe(3);
  });

  it('resolves TTS provider', () => {
    expect(
      resolveTtsProvider({
        channelTtsProvider: 'edge',
        orgTtsProvider: 'elevenlabs',
        codeDefault: 'auto',
      }),
    ).toBe('edge');
    expect(
      resolveTtsProvider({
        orgTtsProvider: 'openai',
        codeDefault: 'auto',
      }),
    ).toBe('openai');
    expect(resolveTtsProvider({ codeDefault: 'auto' })).toBe('auto');
  });
});
