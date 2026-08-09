import { describe, expect, it } from 'vitest';
import {
  boostScoreByQueryRelevance,
  jaccardSimilarity,
  rerankTermsBySubject,
  tokenizeRelevanceText,
} from './stock-relevance.js';

describe('stock-relevance', () => {
  it('tokenizes and scores overlap', () => {
    expect(tokenizeRelevanceText('Ancient Rome senate')).toEqual(['ancient', 'rome', 'senate']);
    expect(jaccardSimilarity(['rome', 'senate'], ['rome', 'forum'])).toBeCloseTo(1 / 3, 5);
  });

  it('reranks terms by subject', () => {
    const ranked = rerankTermsBySubject('roman empire caesar', [
      'ocean waves',
      'caesar rome',
      'forest path',
    ]);
    expect(ranked[0]).toBe('caesar rome');
  });

  it('boosts base score with relevance', () => {
    const boosted = boostScoreByQueryRelevance(100, 'rome forum', 'rome forum ruins');
    expect(boosted).toBeGreaterThan(100);
    expect(boostScoreByQueryRelevance(100, 'rome', '')).toBe(100);
  });
});
