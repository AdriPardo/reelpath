import { describe, expect, it } from 'vitest';
import {
  buildAiImagePrompt,
  buildI2vMotionPrompt,
  getVisualPromptGenerationRules,
  isGenericVisualPrompt,
  motionPresetToCameraPrompt,
  resolveImageStyleFamily,
} from './prompt-visual.js';

describe('prompt-visual', () => {
  it('detects generic visual prompts', () => {
    expect(isGenericVisualPrompt('cinematic')).toBe(true);
    expect(isGenericVisualPrompt('cinematic, dramatic lighting, historical')).toBe(true);
    expect(
      isGenericVisualPrompt(
        'Close-up of cracked wax seal on parchment under warm lamp, archival desk clutter',
      ),
    ).toBe(false);
  });

  it('resolves style family from niche', () => {
    expect(resolveImageStyleFamily('escándalos corporativos y fraude')).toBe(
      'corporate_investigative',
    );
    expect(resolveImageStyleFamily('historia y curiosidades')).toBe('historical_documentary');
    expect(resolveImageStyleFamily('tecnología y productividad')).toBe('general_documentary');
  });

  it('builds niche-aware AI image prompts without forcing historical style', () => {
    const corporate = buildAiImagePrompt({
      visualPrompt: 'Executive signing documents in glass boardroom at dusk, cool LED practicals',
      narration: 'El CEO firmó el acuerdo minutos antes del anuncio.',
      sceneIndex: 2,
      aspectRatio: '16:9',
      niche: 'fraude corporativo',
    });
    expect(corporate.toLowerCase()).toContain('corporate');
    expect(corporate.toLowerCase()).not.toContain('historical documentary still');
    expect(corporate).toContain('no text');

    const history = buildAiImagePrompt({
      visualPrompt: 'Wide shot of Roman forum ruins at golden hour with dramatic clouds',
      narration: 'El foro quedó vacío tras el edicto.',
      sceneIndex: 1,
      aspectRatio: '9:16',
      niche: 'historia antigua',
    });
    expect(history.toLowerCase()).toContain('historical');
    expect(history.toLowerCase()).toContain('vertical 9:16');
  });

  it('falls back to narration when visualPrompt is generic', () => {
    const prompt = buildAiImagePrompt({
      visualPrompt: 'cinematic',
      narration: 'Un contable junior detectó discrepancias en las reservas ocultas.',
      sceneIndex: 0,
      aspectRatio: '16:9',
      niche: 'fraude',
    });
    expect(prompt).toContain('contable');
    expect(prompt.toLowerCase()).toContain('investigative');
  });

  it('maps motion presets to camera language', () => {
    expect(motionPresetToCameraPrompt('push-in')).toMatch(/push-in/i);
    expect(motionPresetToCameraPrompt('pan-left')).toMatch(/pan left/i);
  });

  it('builds i2v motion prompts from preset', () => {
    const p = buildI2vMotionPrompt({
      visualPrompt: 'Archival maps on wooden table',
      narration: 'Los mapas revelaron la ruta.',
      motionPreset: 'drift-up',
    });
    expect(p.toLowerCase()).toContain('upward');
    expect(p.toLowerCase()).toContain('no text');
  });

  it('returns mode-specific visual generation rules', () => {
    const stock = getVisualPromptGenerationRules('stock');
    expect(stock).toContain('3-6');
    expect(stock).toContain('stockQuery');

    const image = getVisualPromptGenerationRules('image');
    expect(image).toContain('15-30');
    expect(image).not.toContain('escenas pares');

    const mixed = getVisualPromptGenerationRules('mixed');
    expect(mixed).toContain('pares');
    expect(mixed).toContain('impares');
  });
});
