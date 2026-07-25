import type { AppConfig } from '@autotube/config';

export type TtsProviderName = 'elevenlabs' | 'edge' | 'openai' | 'mock';

export interface TtsSynthesisOptions {
  text: string;
  language: string;
  outPath: string;
  config: AppConfig;
  retentionMode?: boolean;
}

export interface TtsProvider {
  name: TtsProviderName;
  synthesize(options: TtsSynthesisOptions): Promise<void>;
}

export function resolveTtsProvider(config: AppConfig): TtsProviderName {
  const explicit = config.TTS_PROVIDER;
  if (explicit !== 'auto') {
    return explicit;
  }

  if (config.ELEVENLABS_API_KEY) return 'elevenlabs';
  if (config.TTS_ENABLE_EDGE) return 'edge';
  if (config.OPENAI_API_KEY) return 'openai';
  return 'mock';
}
