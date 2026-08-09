import { describe, expect, it } from 'vitest';
import {
  buildSocialMetadataFallback,
  finalizeSocialMetadata,
  normalizeHashtags,
} from './social-metadata.js';

describe('social-metadata', () => {
  it('normaliza hashtags y dedupe', () => {
    expect(normalizeHashtags(['#Shorts', 'shorts', 'AI', '#AI'], 5)).toEqual([
      '#Shorts',
      '#AI',
    ]);
  });

  it('fallback youtube shorts añade #Shorts', () => {
    const meta = buildSocialMetadataFallback({
      platform: 'youtube_shorts',
      subject: 'Historia romana',
      script: 'Los acueductos cambiaron el imperio. Segunda frase.',
      tags: ['historia'],
    });
    expect(meta.title).toMatch(/#Shorts/i);
    expect(meta.hashtags.some((h) => /shorts/i.test(h))).toBe(true);
    expect(meta.caption.length).toBeGreaterThan(10);
  });

  it('finalize clampa título largo', () => {
    const meta = finalizeSocialMetadata({
      platform: 'tiktok',
      title: 'x'.repeat(200),
      fallbackSubject: 'Tema',
    });
    expect(meta.title.length).toBeLessThanOrEqual(100);
  });
});
