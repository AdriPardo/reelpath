import { describe, expect, it } from 'vitest';
import { buildStockSearchQuery } from './stock-query.js';

describe('buildStockSearchQuery', () => {
  it('usa stockQuery explícito (máx 4 palabras)', () => {
    expect(
      buildStockSearchQuery({
        stockQuery: 'ocean coral reef diving expedition',
        visualPrompt: 'ignored',
      }),
    ).toBe('ocean coral reef diving');
  });

  it('extrae 1–3 palabras útiles del visualPrompt', () => {
    const q = buildStockSearchQuery({
      visualPrompt:
        'A cinematic close-up shot of weathered Mayan pyramids rising above dense jungle canopy at golden hour',
    });
    expect(q.split(/\s+/).length).toBeLessThanOrEqual(3);
    expect(q).toMatch(/mayan|pyramid|jungle|canopy|weathered/i);
    expect(q).not.toMatch(/cinematic|close|shot|showing/i);
  });

  it('fallback documental si vacío', () => {
    expect(buildStockSearchQuery({})).toBe('documentary');
  });
});
