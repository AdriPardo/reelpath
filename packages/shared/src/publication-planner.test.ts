import { describe, expect, it } from 'vitest';
import { resolvePlannerConfig } from './publication-planner.js';

describe('resolvePlannerConfig', () => {
  it('aplica defaults cuando faltan campos', () => {
    const cfg = resolvePlannerConfig({ niche: 'test' } as never);
    expect(cfg.timezone).toBe('Europe/Madrid');
    expect(cfg.maxLongsPerWeek).toBe(1);
    expect(cfg.publishPlannerEnabled).toBe(false);
  });

  it('respeta maxLongsPerWeek del canal', () => {
    const cfg = resolvePlannerConfig({ niche: 'test', maxLongsPerWeek: 2 } as never);
    expect(cfg.maxLongsPerWeek).toBe(2);
    expect(cfg.minDaysBetweenLongs).toBeGreaterThanOrEqual(1);
  });
});
