import { describe, expect, it } from 'vitest';
import { publicationPlanVideoWhere } from './video-schedule-reconcile.js';

describe('publicationPlanVideoWhere', () => {
  const now = new Date('2026-07-29T20:00:00.000Z');

  it('incluye pendientes sin YouTube y programados futuros en YouTube', () => {
    const where = publicationPlanVideoWhere('ch1', now);
    expect(where.channelId).toBe('ch1');
    expect(where.reviewStatus).toEqual({ in: ['pending', 'approved', 'scheduled'] });
    expect(where.OR).toEqual([
      { youtubeVideoId: null },
      {
        youtubeVideoId: { not: null },
        scheduledPublishAt: { gt: now },
      },
    ]);
  });
});
