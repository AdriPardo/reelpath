import { describe, expect, it } from 'vitest';
import { computeVisualOriginSummary } from './visual-origin.js';

describe('computeVisualOriginSummary', () => {
  it('resume stock, IA y placeholders por escena', () => {
    const summary = computeVisualOriginSummary([
      { sceneIndex: 0, type: 'video', metadata: { visualOrigin: 'stock' } },
      { sceneIndex: 1, type: 'image', metadata: { visualOrigin: 'ai' } },
      { sceneIndex: 2, type: 'image', metadata: { visualOrigin: 'placeholder' } },
    ]);

    expect(summary).toMatchObject({
      stock: 1,
      ai: 1,
      placeholder: 1,
      total: 3,
      hasPlaceholders: true,
    });
    expect(summary?.scenes).toHaveLength(3);
    expect(summary?.stockCredits).toEqual([]);
  });

  it('recoge créditos stock únicos', () => {
    const summary = computeVisualOriginSummary([
      {
        sceneIndex: 0,
        type: 'video',
        metadata: {
          visualOrigin: 'stock',
          stockProvider: 'pexels',
          stockCreator: 'Ada',
          stockSourcePage: 'https://pexels.com/x',
        },
      },
      {
        sceneIndex: 1,
        type: 'video',
        metadata: {
          visualOrigin: 'stock',
          stockProvider: 'pexels',
          stockCreator: 'Ada',
          stockSourcePage: 'https://pexels.com/x',
        },
      },
    ]);
    expect(summary?.stockCredits).toHaveLength(1);
    expect(summary?.stockCredits[0]).toMatchObject({
      provider: 'pexels',
      creator: 'Ada',
    });
  });

  it('devuelve null sin assets visuales', () => {
    expect(computeVisualOriginSummary([{ sceneIndex: -1, type: 'subtitle' }])).toBeNull();
  });
});
