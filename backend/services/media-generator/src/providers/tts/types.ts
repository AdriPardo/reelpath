import type { AppConfig } from '@autotube/config';
import type { WordBoundaryLike } from '@autotube/shared';

export type TtsProviderName = 'elevenlabs' | 'edge' | 'openai' | 'mock';

export interface TtsSynthesisOptions {
  text: string;
  language: string;
  outPath: string;
  config: AppConfig;
  retentionMode?: boolean;
}

export interface TtsSynthesisResult {
  wordBoundaries?: WordBoundaryLike[];
}

export interface TtsProvider {
  name: TtsProviderName;
  synthesize(options: TtsSynthesisOptions): Promise<TtsSynthesisResult | void>;
}

export function resolveTtsProvider(config: AppConfig): TtsProviderName {
  const explicit = config.TTS_PROVIDER;
  if (explicit !== 'auto') {
    return explicit;
  }

  // Cost-efficient default: free Edge first (even if ElevenLabs key is set).
  if (config.TTS_ENABLE_EDGE) return 'edge';
  if (config.ELEVENLABS_API_KEY) return 'elevenlabs';
  if (config.OPENAI_API_KEY) return 'openai';
  return 'mock';
}
