import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  subtitleColorsAreIndistinguishable,
  subtitleTextNeedsExtendedFont,
  warnSubtitleStyle,
} from './subtitle-style.js';

describe('subtitle-style', () => {
  it('detecta contraste bajo blanco/blanco', () => {
    expect(subtitleColorsAreIndistinguishable('#FFFFFF', '#FEFEFE')).toBe(true);
    expect(subtitleColorsAreIndistinguishable('#FFFFFF', '#000000')).toBe(false);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeGreaterThan(20);
  });

  it('detecta scripts extendidos', () => {
    expect(subtitleTextNeedsExtendedFont('Hola mundo')).toBe(false);
    expect(subtitleTextNeedsExtendedFont('こんにちは')).toBe(true);
  });

  it('warnSubtitleStyle acumula avisos', () => {
    const w = warnSubtitleStyle({
      fgHex: '#FFFFFF',
      bgHex: '#EEEEEE',
      sampleText: '你好',
    });
    expect(w.some((x) => x.includes('contrast'))).toBe(true);
    expect(w.some((x) => x.includes('non-Latin'))).toBe(true);
  });
});
