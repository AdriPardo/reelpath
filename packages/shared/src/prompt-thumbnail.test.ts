import { describe, expect, it } from 'vitest';
import {
  buildThumbnailBackgroundPrompt,
  buildThumbnailCopyPrompt,
  deriveThumbnailOverlayText,
  getThumbnailCopyRules,
} from './prompt-thumbnail.js';

describe('prompt-thumbnail', () => {
  it('derives short overlay from hook', () => {
    const text = deriveThumbnailOverlayText({
      title: 'La historia olvidada del tratado que cambió Europa para siempre',
      hook: '¿2.400 millones desaparecidos?',
    });
    expect(text.length).toBeLessThanOrEqual(42);
    expect(text).toContain('2.400');
    expect(text).toBe(text.toUpperCase());
  });

  it('truncates long titles without hook', () => {
    const text = deriveThumbnailOverlayText({
      title: 'El emperador romano que nombró cónsul a su caballo y humilló al senado entero',
    });
    expect(text.length).toBeLessThanOrEqual(42);
    expect(text.length).toBeGreaterThan(5);
  });

  it('builds LLM copy prompt with CTR rules', () => {
    const { system, user } = buildThumbnailCopyPrompt({
      title: 'Theranos',
      hook: 'Sangre falsa',
      format: 'long',
      language: 'es',
    });
    expect(system).toContain('miniaturas');
    expect(user).toContain('overlayText');
    expect(getThumbnailCopyRules('long')).toContain('2-5');
  });

  it('builds AI background with text-safe negative space', () => {
    const p = buildThumbnailBackgroundPrompt({
      title: 'El fraude',
      hook: 'Nadie revisó los números',
      niche: 'fraude corporativo',
      aspectRatio: '16:9',
    });
    expect(p.toLowerCase()).toContain('thumbnail');
    expect(p.toLowerCase()).toContain('no text');
    expect(p.toLowerCase()).toMatch(/left|right|negative space/);
    expect(p.toLowerCase()).toContain('investigative');
  });
});
