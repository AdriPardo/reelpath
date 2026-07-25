import { describe, expect, it } from 'vitest';
import {
  applyRetentionFeedbackToCalendar,
  buildPublicationCalendar,
  evaluateSlotRetentionFeedback,
  type RetentionByPublishHour,
} from './publication-planner.js';

describe('evaluateSlotRetentionFeedback', () => {
  it('avisa cuando la retención del slot está por debajo de la media', () => {
    const retentionByHour: RetentionByPublishHour = new Map([
      [19, { avgRetention: 0.2, sampleCount: 3 }],
    ]);
    const feedback = evaluateSlotRetentionFeedback({
      slot: new Date('2026-07-15T17:00:00.000Z'),
      channelTimezone: 'Europe/Madrid',
      channelAvgRetention: 0.5,
      retentionByHour,
    });
    expect(feedback?.severity).toBe('warning');
    expect(feedback?.message).toContain('Considera otro slot');
  });

  it('no avisa si la retención del slot es aceptable', () => {
    const retentionByHour: RetentionByPublishHour = new Map([
      [19, { avgRetention: 0.45, sampleCount: 2 }],
    ]);
    const feedback = evaluateSlotRetentionFeedback({
      slot: new Date('2026-07-15T17:00:00.000Z'),
      channelTimezone: 'Europe/Madrid',
      channelAvgRetention: 0.5,
      retentionByHour,
    });
    expect(feedback).toBeNull();
  });
});

describe('applyRetentionFeedbackToCalendar', () => {
  it('adjunta feedback a entradas del calendario', () => {
    const base = buildPublicationCalendar(
      {
        niche: 'historia',
        publishPlannerEnabled: true,
        maxLongsPerWeek: 2,
        preferredPublishHour: 19,
        preferredPublishDays: [5],
      } as never,
      [{ videoId: 'v1', title: 'Test', scheduledAt: new Date('2026-07-18T17:00:00.000Z') }],
    );
    const retentionByHour: RetentionByPublishHour = new Map([
      [19, { avgRetention: 0.15, sampleCount: 2 }],
    ]);
    const enriched = applyRetentionFeedbackToCalendar(base, 0.4, retentionByHour);
    expect(enriched.entries[0]?.slotFeedback).not.toBeNull();
    expect(enriched.plannerFeedback?.length).toBeGreaterThan(0);
  });
});
