import { describe, expect, it } from 'vitest';
import {
  boundariesToWordTimings,
  buildKaraokeAssFromWordTimings,
  buildPhraseCuesFromWordTimings,
} from './word-timing.js';

describe('word-timing', () => {
  it('convierte ticks 100ns a segundos', () => {
    const words = boundariesToWordTimings([
      { text: 'Hola', offset: 0, duration: 5_000_000 },
      { text: 'mundo', offset: 5_000_000, duration: 5_000_000 },
    ]);
    expect(words).toHaveLength(2);
    expect(words[0]).toMatchObject({ text: 'Hola', startSec: 0, endSec: 0.5 });
    expect(words[1]).toMatchObject({ text: 'mundo', startSec: 0.5, endSec: 1 });
  });

  it('agrupa frases por puntuación', () => {
    const words = boundariesToWordTimings([
      { text: 'Uno', offset: 0, duration: 2_000_000 },
      { text: 'dos.', offset: 2_000_000, duration: 2_000_000 },
      { text: 'Tres', offset: 4_000_000, duration: 2_000_000 },
    ]);
    const cues = buildPhraseCuesFromWordTimings(words, 10, 1);
    expect(cues.length).toBeGreaterThanOrEqual(2);
    expect(cues[0]!.text).toContain('Uno');
  });

  it('genera ASS karaoke con \\kf', () => {
    const words = boundariesToWordTimings([
      { text: 'Hola', offset: 0, duration: 5_000_000 },
      { text: 'mundo', offset: 5_000_000, duration: 5_000_000 },
    ]);
    const ass = buildKaraokeAssFromWordTimings(words, 1);
    expect(ass).toContain('\\kf');
    expect(ass).toContain('Hola');
    expect(ass).toContain('mundo');
  });
});
