import { describe, expect, it } from 'vitest';
import { mergeChannelProductOverrides } from './org-runtime.js';

describe('mergeChannelProductOverrides (channel > org)', () => {
  it('keeps org voices when channel empty', () => {
    expect(
      mergeChannelProductOverrides(
        { edgeTtsVoice: 'es-ES-ElviraNeural', elevenLabsVoiceId: 'org-11' },
        {},
      ),
    ).toEqual({
      edgeTtsVoice: 'es-ES-ElviraNeural',
      elevenLabsVoiceId: 'org-11',
    });
  });

  it('overrides product fields from channel', () => {
    expect(
      mergeChannelProductOverrides(
        {
          ttsProvider: 'auto',
          edgeTtsVoice: 'es-ES-ElviraNeural',
          maxAiImagesPerVideo: 4,
          openaiImageQuality: 'medium',
        },
        {
          ttsProvider: 'edge',
          edgeTtsVoice: 'es-MX-DaliaNeural',
          maxAiImagesPerVideo: 2,
          openaiImageQuality: 'high',
          generateAiImages: true,
        },
      ),
    ).toEqual({
      ttsProvider: 'edge',
      edgeTtsVoice: 'es-MX-DaliaNeural',
      maxAiImagesPerVideo: 2,
      openaiImageQuality: 'high',
      generateAiImages: true,
    });
  });

  it('works from null org', () => {
    expect(
      mergeChannelProductOverrides(null, { openaiTtsVoice: 'shimmer', maxScenesShort: 5 }),
    ).toEqual({
      openaiTtsVoice: 'shimmer',
      maxScenesShort: 5,
    });
  });
});
