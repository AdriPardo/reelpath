import { describe, expect, it } from 'vitest';
import {
  buildThumbnailBackgroundPrompt,
  buildThumbnailCopyPrompt,
  deriveThumbnailOverlayText,
  getThumbnailCopyRules,
  pickThumbnailHighlightWord,
} from './prompt-thumbnail.js';

describe('prompt-thumbnail', () => {
  it('derives short overlay from hook with number lead', () => {
    const text = deriveThumbnailOverlayText({
      title: 'La historia olvidada del tratado que cambió Europa para siempre',
      hook: '¿2.400 millones desaparecidos en 48 horas?',
      maxChars: 28,
    });
    expect(text.length).toBeLessThanOrEqual(28);
    expect(text).toMatch(/2\.?400/i);
    expect(text).toBe(text.toUpperCase());
  });

  it('truncates long titles without hook', () => {
    const text = deriveThumbnailOverlayText({
      title: 'El emperador romano que nombró cónsul a su caballo y humilló al senado entero',
      maxChars: 28,
    });
    expect(text.length).toBeLessThanOrEqual(28);
    expect(text.length).toBeGreaterThan(5);
  });

  it('picks highlight word from digits or power words', () => {
    expect(pickThumbnailHighlightWord('2.400M MENTIRA')).toContain('2.400');
    expect(pickThumbnailHighlightWord('FRAUDE TOTAL')).toBe('FRAUDE');
    expect(pickThumbnailHighlightWord('EMPERADOR LOCO')).toBe('LOCO');
  });

  it('builds LLM copy prompt with CTR rules and highlight', () => {
    const { system, user } = buildThumbnailCopyPrompt({
      title: 'Theranos',
      hook: 'Sangre falsa',
      format: 'long',
      language: 'es',
    });
    expect(system.toLowerCase()).toContain('ctr');
    expect(user).toContain('highlightWord');
    expect(getThumbnailCopyRules('long')).toContain('2-4');
  });

  it('builds AI background as viral scroll-stopper with text-safe space', () => {
    const p = buildThumbnailBackgroundPrompt({
      title: 'El fraude',
      hook: 'Nadie revisó los números',
      niche: 'fraude corporativo',
      aspectRatio: '16:9',
    });
    expect(p.toLowerCase()).toContain('thumbnail');
    expect(p.toLowerCase()).toContain('no text');
    expect(p.toLowerCase()).toMatch(/left|right|negative|clean/);
    expect(p.toLowerCase()).toContain('investigative');
    expect(p.toLowerCase()).toMatch(/160px|scroll|viral/);
  });
});
