import { describe, expect, it } from 'vitest';
import { ttsPreviewCacheKey } from './tts-preview-cache.js';

describe('ttsPreviewCacheKey', () => {
  it('es estable para mismos inputs', () => {
    const a = ttsPreviewCacheKey({
      provider: 'edge',
      voiceId: 'es-ES-ElviraNeural',
      text: 'Hola',
      language: 'es',
    });
    const b = ttsPreviewCacheKey({
      provider: 'EDGE',
      voiceId: 'es-ES-ElviraNeural',
      text: 'Hola',
      language: 'ES',
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('cambia si cambia la voz', () => {
    const a = ttsPreviewCacheKey({
      provider: 'edge',
      voiceId: 'a',
      text: 'x',
      language: 'es',
    });
    const b = ttsPreviewCacheKey({
      provider: 'edge',
      voiceId: 'b',
      text: 'x',
      language: 'es',
    });
    expect(a).not.toBe(b);
  });
});
