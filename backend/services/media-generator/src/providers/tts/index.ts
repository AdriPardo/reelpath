import type { AppConfig } from '@autotube/config';
import { edgeProvider } from './edge-tts.js';
import { elevenLabsProvider } from './elevenlabs-tts.js';
import { openAiProvider } from './openai-tts.js';
import { resolveTtsProvider, type TtsProvider, type TtsProviderName } from './types.js';

const providers: Record<Exclude<TtsProviderName, 'mock'>, TtsProvider> = {
  elevenlabs: elevenLabsProvider,
  edge: edgeProvider,
  openai: openAiProvider,
};

/** Provider chain for auto mode: ElevenLabs → Edge (free) → OpenAI. */
export function getTtsFallbackChain(config: AppConfig): TtsProvider[] {
  if (config.TTS_PROVIDER !== 'auto') {
    if (config.TTS_PROVIDER === 'mock') return [];
    return providers[config.TTS_PROVIDER] ? [providers[config.TTS_PROVIDER]] : [];
  }

  const chain: TtsProvider[] = [];
  if (config.ELEVENLABS_API_KEY) chain.push(elevenLabsProvider);
  if (config.TTS_ENABLE_EDGE) chain.push(edgeProvider);
  if (config.OPENAI_API_KEY) chain.push(openAiProvider);
  return chain;
}

export { resolveTtsProvider };
export type { TtsProviderName };
