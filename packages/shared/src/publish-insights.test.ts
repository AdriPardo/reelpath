import { describe, expect, it } from 'vitest';
import {
  PUBLISH_INSIGHTS_MIN_SAMPLES,
  applyInsightsToPlannerConfig,
  buildPublishInsights,
  emptyPublishInsights,
  scorePublishBucket,
  shouldAutoGenerateForSlot,
} from './publish-insights.js';
import { resolvePlannerConfig } from './publication-planner.js';

describe('publish-insights', () => {
  it('scorePublishBucket weights retention highest', () => {
    const highRet = scorePublishBucket({ retention: 0.8, views: 10, ctr: 0.01 });
    const highViews = scorePublishBucket({ retention: 0.2, views: 10_000, ctr: 0.01 }, {
      maxViews: 10_000,
      maxCtr: 0.1,
    });
    expect(highRet).toBeGreaterThan(0.3);
    expect(highViews).toBeLessThan(highRet + 0.2);
  });

  it('buildPublishInsights is not confident below threshold', () => {
    const hourBuckets = new Map([[19, { retention: 0.5, views: 100, ctr: 0.05 }]]);
    const dayBuckets = new Map([[5, { retention: 0.5, views: 100, ctr: 0.05 }]]);
    const insights = buildPublishInsights({
      sampleCount: PUBLISH_INSIGHTS_MIN_SAMPLES - 1,
      hourBuckets,
      dayBuckets,
    });
    expect(insights.confident).toBe(false);
    expect(insights.source).toBe('heuristic');
    expect(insights.bestHours[0]).toBe(19);
  });

  it('applyInsightsToPlannerConfig overrides hour only when confident', () => {
    const base = resolvePlannerConfig({
      niche: 'x',
      language: 'es',
      videoFormat: 'long',
      aspectRatio: '16:9',
      targetDurationSec: 600,
      templateId: 't',
      reviewRequired: false,
      preferredPublishHour: 19,
      preferredPublishDays: [2, 5],
      publishPlannerEnabled: true,
    });

    const weak = emptyPublishInsights();
    expect(applyInsightsToPlannerConfig(base, weak).preferredPublishHour).toBe(19);

    const strong = buildPublishInsights({
      sampleCount: PUBLISH_INSIGHTS_MIN_SAMPLES,
      hourBuckets: new Map([
        [12, { retention: 0.9, views: 500, ctr: 0.08 }],
        [19, { retention: 0.3, views: 100, ctr: 0.02 }],
      ]),
      dayBuckets: new Map([
        [5, { retention: 0.8, views: 400, ctr: 0.07 }],
        [2, { retention: 0.4, views: 100, ctr: 0.02 }],
      ]),
    });
    expect(strong.confident).toBe(true);
    const applied = applyInsightsToPlannerConfig(base, strong);
    expect(applied.preferredPublishHour).toBe(12);
    expect(applied.preferredPublishDays[0]).toBe(5);
    expect(applied.preferredPublishDays).toEqual([5, 2]);
  });

  it('shouldAutoGenerateForSlot respects lead days', () => {
    const getZoned = (date: Date) => ({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: 0,
      minute: 0,
      weekday: 0,
    });
    // Publish Friday 2026-08-07 17:00 UTC; lead 1 → generate Thursday 2026-08-06
    const publishAt = new Date('2026-08-07T17:00:00.000Z');
    const wednesday = new Date('2026-08-05T10:00:00.000Z');
    const thursday = new Date('2026-08-06T10:00:00.000Z');
    expect(
      shouldAutoGenerateForSlot({
        now: wednesday,
        publishAt,
        timeZone: 'UTC',
        leadDays: 1,
        getZoned,
      }),
    ).toBe(false);
    expect(
      shouldAutoGenerateForSlot({
        now: thursday,
        publishAt,
        timeZone: 'UTC',
        leadDays: 1,
        getZoned,
      }),
    ).toBe(true);
  });
});
