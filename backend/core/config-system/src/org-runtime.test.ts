import { describe, expect, it } from 'vitest';
import { mergeChannelVoiceOverrides } from './org-runtime.js';

describe('mergeChannelVoiceOverrides (channel > org)', () => {
  it('keeps org voices when channel is empty', () => {
    expect(
      mergeChannelVoiceOverrides(
        { edgeTtsVoice: 'es-ES-ElviraNeural', elevenLabsVoiceId: 'org-11' },
        {},
      ),
    ).toEqual({
      edgeTtsVoice: 'es-ES-ElviraNeural',
      elevenLabsVoiceId: 'org-11',
    });
  });

  it('overrides only set channel voices', () => {
    expect(
      mergeChannelVoiceOverrides(
        {
          edgeTtsVoice: 'es-ES-ElviraNeural',
          elevenLabsVoiceId: 'org-11',
          openaiTtsVoice: 'nova',
        },
        { edgeTtsVoice: 'es-MX-DaliaNeural', openaiTtsVoice: null },
      ),
    ).toEqual({
      edgeTtsVoice: 'es-MX-DaliaNeural',
      elevenLabsVoiceId: 'org-11',
      openaiTtsVoice: 'nova',
    });
  });

  it('works with null org overrides', () => {
    expect(
      mergeChannelVoiceOverrides(null, { openaiTtsVoice: 'shimmer' }),
    ).toEqual({ openaiTtsVoice: 'shimmer' });
  });
});
