import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  FFMPEG_CONCURRENCY_DEFAULT,
  FFMPEG_THREADS_DEFAULT,
  buildLanczosScaleCrop,
  getFfmpegConcurrency,
  getFfmpegNice,
  getFfmpegScaleFlags,
  getFfmpegThreads,
  getFfmpegVideoPreset,
  isFfmpegFilmGrainEnabled,
  ffmpegH264EncodeArgs,
} from './video-encoding.js';

const ENV_KEYS = [
  'FFMPEG_THREADS',
  'FFMPEG_CONCURRENCY',
  'FFMPEG_NICE',
  'FFMPEG_PRESET',
  'FFMPEG_SCALE_FLAGS',
  'FFMPEG_ENABLE_FILM_GRAIN',
  'FFMPEG_CRF',
] as const;

describe('video-encoding VPS defaults', () => {
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const v = saved[key];
      if (v === undefined) delete process.env[key];
      else process.env[key] = v;
    }
  });

  it('defaults threads and concurrency for small VPS', () => {
    expect(getFfmpegThreads()).toBe(FFMPEG_THREADS_DEFAULT);
    expect(getFfmpegConcurrency()).toBe(FFMPEG_CONCURRENCY_DEFAULT);
    expect(getFfmpegThreads()).toBe(2);
    expect(getFfmpegConcurrency()).toBe(1);
  });

  it('reads FFMPEG_THREADS / FFMPEG_CONCURRENCY', () => {
    process.env.FFMPEG_THREADS = '4';
    process.env.FFMPEG_CONCURRENCY = '2';
    expect(getFfmpegThreads()).toBe(4);
    expect(getFfmpegConcurrency()).toBe(2);
  });

  it('defaults preset to veryfast', () => {
    expect(getFfmpegVideoPreset()).toBe('veryfast');
    process.env.FFMPEG_PRESET = 'medium';
    expect(getFfmpegVideoPreset()).toBe('medium');
  });

  it('defaults scale flags to bicubic (cheaper than lanczos)', () => {
    expect(getFfmpegScaleFlags()).toBe('bicubic');
    expect(buildLanczosScaleCrop(1920, 1080)).toContain('flags=bicubic');
    process.env.FFMPEG_SCALE_FLAGS = 'lanczos';
    expect(buildLanczosScaleCrop(1920, 1080)).toContain('flags=lanczos');
  });

  it('film grain off by default', () => {
    expect(isFfmpegFilmGrainEnabled()).toBe(false);
    process.env.FFMPEG_ENABLE_FILM_GRAIN = 'true';
    expect(isFfmpegFilmGrainEnabled()).toBe(true);
  });

  it('includes -threads in encode args', () => {
    const args = ffmpegH264EncodeArgs();
    expect(args).toContain('-threads');
    expect(args).toContain('2');
    expect(args).toContain('veryfast');
  });

  it('parses FFMPEG_NICE', () => {
    expect(getFfmpegNice()).toBeNull();
    process.env.FFMPEG_NICE = '10';
    expect(getFfmpegNice()).toBe(10);
  });
});
