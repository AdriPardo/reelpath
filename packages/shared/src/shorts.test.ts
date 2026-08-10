import { describe, expect, it } from 'vitest';
import {
  expectedShortsPartCount,
  planSegmentDurations,
  planShortClipSegments,
  resolveLongShortsFromVideo,
  splitEvenly,
  YOUTUBE_SHORTS_HARD_MAX_SEC,
} from './shorts.js';

describe('planSegmentDurations', () => {
  it('un clip si cabe en soft-max (algo más largo que maxSec)', () => {
    expect(planSegmentDurations(70, 60, 15)).toEqual([70]);
    expect(planSegmentDurations(75, 60, 15)).toEqual([75]);
  });

  it('reparte en tantos shorts como haga falta bajo soft-max', () => {
    const d = planSegmentDurations(150, 60, 15);
    expect(d.length).toBe(2); // softMax=75 → 2×75
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(150, 2);
    expect(Math.max(...d)).toBeLessThanOrEqual(75.01);
  });

  it('cubre un largo típico sin restos minúsculos', () => {
    const d = planSegmentDurations(600, 60, 15);
    expect(d.length).toBeGreaterThanOrEqual(8);
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(600, 2);
    expect(Math.min(...d)).toBeGreaterThan(50);
  });
});

describe('planShortClipSegments', () => {
  it('auto cubre el vídeo entero', () => {
    const segs = planShortClipSegments(400, 60, { coverFullVideo: true });
    const covered = segs.reduce((a, s) => a + s.durationSec, 0);
    expect(covered).toBeCloseTo(400, 2);
    expect(segs[0]!.startSec).toBe(0);
  });

  it('con maxParts insuficiente sube el conteo por hard-max', () => {
    // 20 min, maxParts=3, hard 180 → hacen falta ≥7
    const segs = planShortClipSegments(1200, 60, {
      maxParts: 3,
      coverFullVideo: true,
      hardMaxSec: YOUTUBE_SHORTS_HARD_MAX_SEC,
    });
    expect(segs.length).toBeGreaterThanOrEqual(7);
    expect(Math.max(...segs.map((s) => s.durationSec))).toBeLessThanOrEqual(
      YOUTUBE_SHORTS_HARD_MAX_SEC + 0.05,
    );
    expect(segs.reduce((a, s) => a + s.durationSec, 0)).toBeCloseTo(1200, 2);
  });

  it('mixto (sin cover) muestreá N highlights sin cubrir todo', () => {
    const segs = planShortClipSegments(600, 60, {
      maxParts: 2,
      coverFullVideo: false,
    });
    expect(segs.length).toBe(2);
    const covered = segs.reduce((a, s) => a + s.durationSec, 0);
    expect(covered).toBeLessThan(600);
  });

  it('expectedShortsPartCount coincide con el plan', () => {
    expect(expectedShortsPartCount(130, 60)).toBe(planShortClipSegments(130, 60).length);
  });
});

describe('splitEvenly / resolveLongShortsFromVideo', () => {
  it('splitEvenly suma el total', () => {
    const d = splitEvenly(100, 3);
    expect(d).toHaveLength(3);
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
  });

  it('permite hasta 30 partes del largo', () => {
    expect(resolveLongShortsFromVideo(30)).toBe(30);
    expect(resolveLongShortsFromVideo(99)).toBe(30);
    expect(resolveLongShortsFromVideo(undefined)).toBeUndefined();
  });
});
