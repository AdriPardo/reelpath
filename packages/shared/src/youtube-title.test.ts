import { describe, expect, it } from 'vitest';
import {
  YOUTUBE_TITLE_MAX_CHARS,
  clampYouTubeTitle,
  formatYouTubePartTitle,
  formatYouTubeShortTitle,
  youtubeLongTitleMaxForShortParts,
  youtubeShortsTitleBudget,
} from './youtube-title.js';

const LONG =
  'El error matemático que salvó al mundo: Oleg Penkovsky y la Crisis de los Misiles';

describe('youtube-title', () => {
  it('clamps overlong titles to 100', () => {
    const title = `${LONG} — Parte 1/3 #Shorts`;
    expect(title.length).toBeGreaterThan(YOUTUBE_TITLE_MAX_CHARS);
    const clamped = clampYouTubeTitle(title);
    expect(clamped.length).toBeLessThanOrEqual(YOUTUBE_TITLE_MAX_CHARS);
    expect(clamped).toContain('Parte');
  });

  it('formatYouTubePartTitle is complete when long title respects budget', () => {
    const max = youtubeLongTitleMaxForShortParts();
    const fitted = clampYouTubeTitle(LONG, 'Short', max);
    expect(fitted.length).toBeLessThanOrEqual(max);
    const part = formatYouTubePartTitle(fitted, 1, 3);
    expect(part).toBe(`${fitted} — Parte 1/3`);
    expect(part.length).toBeLessThanOrEqual(youtubeShortsTitleBudget());
    expect(formatYouTubeShortTitle(part).length).toBeLessThanOrEqual(YOUTUBE_TITLE_MAX_CHARS);
  });

  it('formatYouTubeShortTitle keeps #Shorts within 100', () => {
    const short = formatYouTubeShortTitle(LONG);
    expect(short).toMatch(/#Shorts$/);
    expect(short.length).toBeLessThanOrEqual(YOUTUBE_TITLE_MAX_CHARS);
  });

  it('youtubeLongTitleMaxForShortParts leaves room for Parte + #Shorts', () => {
    const max = youtubeLongTitleMaxForShortParts();
    const full = `${'x'.repeat(max)} — Parte 3/3 #Shorts`;
    expect(full.length).toBeLessThanOrEqual(YOUTUBE_TITLE_MAX_CHARS);
  });
});
