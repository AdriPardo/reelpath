import { describe, expect, it } from 'vitest';
import { averageEngagement } from './engagement.js';
import { parseYouTubeDurationSec } from './youtube-analytics.js';

describe('averageEngagement', () => {
  it('returns null when all CTR/retention are zero', () => {
    expect(
      averageEngagement([
        { views: 100, ctr: 0, retention: 0 },
        { views: 50, ctr: 0, retention: 0 },
      ]),
    ).toEqual({ avgCtr: null, avgRetention: null, sampleCount: 0 });
  });

  it('ignores zero-signal videos and weights by views', () => {
    const result = averageEngagement([
      { views: 100, ctr: 0.1, retention: 0.5 },
      { views: 100, ctr: 0, retention: 0 },
      { views: 300, ctr: 0.02, retention: 0.2 },
    ]);
    expect(result.sampleCount).toBe(2);
    expect(result.avgCtr).toBeCloseTo(0.04, 5);
    expect(result.avgRetention).toBeCloseTo(0.275, 5);
  });
});

describe('parseYouTubeDurationSec', () => {
  it('parses ISO durations', () => {
    expect(parseYouTubeDurationSec('PT1H2M3S')).toBe(3723);
    expect(parseYouTubeDurationSec('PT45S')).toBe(45);
    expect(parseYouTubeDurationSec('PT10M')).toBe(600);
    expect(parseYouTubeDurationSec(null)).toBe(0);
  });
});
