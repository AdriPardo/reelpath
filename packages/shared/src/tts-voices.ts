/**
 * Curated TTS voice catalogs for UI + validation.
 * Provider APIs may offer more; these are safe defaults for Spanish/English narration.
 */

export type TtsVoiceProvider = 'edge' | 'elevenlabs' | 'openai';

export type TtsVoiceOption = {
  id: string;
  label: string;
  /** BCP-47-ish locale hint for UI grouping */
  locale: string;
  gender?: 'female' | 'male' | 'neutral';
};

export const OPENAI_TTS_VOICES: TtsVoiceOption[] = [
  { id: 'nova', label: 'Nova', locale: 'en', gender: 'female' },
  { id: 'alloy', label: 'Alloy', locale: 'en', gender: 'neutral' },
  { id: 'echo', label: 'Echo', locale: 'en', gender: 'male' },
  { id: 'fable', label: 'Fable', locale: 'en', gender: 'neutral' },
  { id: 'onyx', label: 'Onyx', locale: 'en', gender: 'male' },
  { id: 'shimmer', label: 'Shimmer', locale: 'en', gender: 'female' },
  { id: 'ash', label: 'Ash', locale: 'en', gender: 'male' },
  { id: 'coral', label: 'Coral', locale: 'en', gender: 'female' },
  { id: 'sage', label: 'Sage', locale: 'en', gender: 'female' },
];

export const EDGE_TTS_VOICES: TtsVoiceOption[] = [
  { id: 'es-ES-ElviraNeural', label: 'Elvira (España)', locale: 'es-ES', gender: 'female' },
  { id: 'es-ES-AlvaroNeural', label: 'Álvaro (España)', locale: 'es-ES', gender: 'male' },
  { id: 'es-MX-DaliaNeural', label: 'Dalia (México)', locale: 'es-MX', gender: 'female' },
  { id: 'es-MX-JorgeNeural', label: 'Jorge (México)', locale: 'es-MX', gender: 'male' },
  { id: 'es-AR-ElenaNeural', label: 'Elena (Argentina)', locale: 'es-AR', gender: 'female' },
  { id: 'es-AR-TomasNeural', label: 'Tomás (Argentina)', locale: 'es-AR', gender: 'male' },
  { id: 'es-CO-SalomeNeural', label: 'Salomé (Colombia)', locale: 'es-CO', gender: 'female' },
  { id: 'es-CO-GonzaloNeural', label: 'Gonzalo (Colombia)', locale: 'es-CO', gender: 'male' },
  { id: 'en-US-JennyNeural', label: 'Jenny (US)', locale: 'en-US', gender: 'female' },
  { id: 'en-US-GuyNeural', label: 'Guy (US)', locale: 'en-US', gender: 'male' },
  { id: 'en-US-AriaNeural', label: 'Aria (US)', locale: 'en-US', gender: 'female' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia (UK)', locale: 'en-GB', gender: 'female' },
  { id: 'en-GB-RyanNeural', label: 'Ryan (UK)', locale: 'en-GB', gender: 'male' },
];

/** Premade multilingual voices suitable for Spanish narration. */
export const ELEVENLABS_TTS_VOICES: TtsVoiceOption[] = [
  { id: 'XrExE9yKIg1WjnnlVkGX', label: 'Matilda', locale: 'multilingual', gender: 'female' },
  { id: 'eHAEFkimnYz57pupUMcq', label: 'Matilda (alt)', locale: 'multilingual', gender: 'female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah', locale: 'multilingual', gender: 'female' },
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel', locale: 'multilingual', gender: 'female' },
  { id: 'AZnzlk1XvdvUeBnXmlld', label: 'Domi', locale: 'multilingual', gender: 'female' },
  { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni', locale: 'multilingual', gender: 'male' },
  { id: 'VR6AewLTigWG4xSOukaG', label: 'Arnold', locale: 'multilingual', gender: 'male' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam', locale: 'multilingual', gender: 'male' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', label: 'Sam', locale: 'multilingual', gender: 'male' },
  { id: 'jBpfuIE2acCO8z3wKNLl', label: 'Gigi', locale: 'multilingual', gender: 'female' },
];

export function getTtsVoicesForProvider(provider: TtsVoiceProvider): TtsVoiceOption[] {
  switch (provider) {
    case 'edge':
      return EDGE_TTS_VOICES;
    case 'elevenlabs':
      return ELEVENLABS_TTS_VOICES;
    case 'openai':
      return OPENAI_TTS_VOICES;
    default:
      return [];
  }
}

export function isKnownTtsVoiceId(provider: TtsVoiceProvider, voiceId: string): boolean {
  const id = voiceId.trim();
  if (!id) return false;
  return getTtsVoicesForProvider(provider).some((v) => v.id === id);
}

/** Voices to show when TTS provider is `auto` (all catalogs). */
export function getAllCuratedTtsVoices(): Array<TtsVoiceOption & { provider: TtsVoiceProvider }> {
  return [
    ...EDGE_TTS_VOICES.map((v) => ({ ...v, provider: 'edge' as const })),
    ...ELEVENLABS_TTS_VOICES.map((v) => ({ ...v, provider: 'elevenlabs' as const })),
    ...OPENAI_TTS_VOICES.map((v) => ({ ...v, provider: 'openai' as const })),
  ];
}
