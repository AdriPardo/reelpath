import { describe, expect, it } from 'vitest';
import { scoreVideoQuality, type VideoQualityInput } from './index.js';

function baseInput(overrides: Partial<VideoQualityInput> = {}): VideoQualityInput {
  return {
    script: {
      variantId: 'A',
      hook: '¿Nunca viste esta verdad prohibida?',
      hookVariant: 'A',
      estimatedDurationSec: 45,
      scenes: [
        {
          index: 0,
          narration: 'Narración escena uno con detalle.',
          visualPrompt: 'roma',
          durationSec: 15,
        },
        {
          index: 1,
          narration: 'Narración escena dos con detalle.',
          visualPrompt: 'senado',
          durationSec: 15,
        },
        {
          index: 2,
          narration: 'Narración escena tres con detalle.',
          visualPrompt: 'cesar',
          durationSec: 15,
        },
      ],
    },
    format: 'shorts',
    durationSec: 45,
    filePathExists: true,
    hasThumbnail: true,
    sceneImageIndexes: [0, 1, 2],
    sceneAudioIndexes: [0, 1, 2],
    hasSubtitles: true,
    title: 'El secreto de Roma en 49 a.C.',
    description: 'Historia concreta',
    ...overrides,
  };
}

describe('scoreVideoQuality hard checks', () => {
  it('pasa con inputs limpios', () => {
    const report = scoreVideoQuality(baseInput());
    expect(report.passed).toBe(true);
    expect(report.checks.find((c) => c.id === 'audio_level')?.status).toBe('pass');
    expect(report.checks.find((c) => c.id === 'stock_dedup')?.status).toBe('pass');
    expect(report.checks.find((c) => c.id === 'bgm_track')?.status).toBe('pass');
    expect(report.checks.find((c) => c.id === 'word_boundaries')?.status).toBe('pass');
  });

  it('falla con audio silencioso múltiple', () => {
    const report = scoreVideoQuality(baseInput({ nearSilentAudioCount: 2 }));
    expect(report.checks.find((c) => c.id === 'audio_level')?.status).toBe('fail');
    expect(report.passed).toBe(false);
  });

  it('warn si BGM on sin track', () => {
    const report = scoreVideoQuality(baseInput({ bgmEnabledWithoutTrack: true }));
    expect(report.checks.find((c) => c.id === 'bgm_track')?.status).toBe('warn');
  });

  it('warn si falta WordBoundary en una escena', () => {
    const report = scoreVideoQuality(baseInput({ missingWordBoundaryCount: 1 }));
    expect(report.checks.find((c) => c.id === 'word_boundaries')?.status).toBe('warn');
  });
});
