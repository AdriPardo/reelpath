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
  /** Short style blurb (ElevenLabs-style cards) */
  description?: string;
  /** Accent / region label for the picker */
  accent?: string;
  /** Optional static preview sample URL */
  previewUrl?: string;
};

export const OPENAI_TTS_VOICES: TtsVoiceOption[] = [
  { id: 'nova', label: 'Nova', locale: 'en', gender: 'female', description: 'Warm and clear', accent: 'English' },
  { id: 'alloy', label: 'Alloy', locale: 'en', gender: 'neutral', description: 'Balanced and neutral', accent: 'English' },
  { id: 'echo', label: 'Echo', locale: 'en', gender: 'male', description: 'Resonant male', accent: 'English' },
  { id: 'fable', label: 'Fable', locale: 'en', gender: 'neutral', description: 'Expressive storytelling', accent: 'English' },
  { id: 'onyx', label: 'Onyx', locale: 'en', gender: 'male', description: 'Deep and steady', accent: 'English' },
  { id: 'shimmer', label: 'Shimmer', locale: 'en', gender: 'female', description: 'Bright and soft', accent: 'English' },
  { id: 'ash', label: 'Ash', locale: 'en', gender: 'male', description: 'Calm narrator', accent: 'English' },
  { id: 'coral', label: 'Coral', locale: 'en', gender: 'female', description: 'Friendly and bright', accent: 'English' },
  { id: 'sage', label: 'Sage', locale: 'en', gender: 'female', description: 'Measured and wise', accent: 'English' },
];

export const EDGE_TTS_VOICES: TtsVoiceOption[] = [
  { id: 'es-ES-ElviraNeural', label: 'Elvira', locale: 'es-ES', gender: 'female', accent: 'España', description: 'Narración clara' },
  { id: 'es-ES-AlvaroNeural', label: 'Álvaro', locale: 'es-ES', gender: 'male', accent: 'España', description: 'Tono documental' },
  { id: 'es-MX-DaliaNeural', label: 'Dalia', locale: 'es-MX', gender: 'female', accent: 'México', description: 'Natural y cercana' },
  { id: 'es-MX-JorgeNeural', label: 'Jorge', locale: 'es-MX', gender: 'male', accent: 'México', description: 'Voz grave estable' },
  { id: 'es-AR-ElenaNeural', label: 'Elena', locale: 'es-AR', gender: 'female', accent: 'Argentina', description: 'Ritmo rioplatense' },
  { id: 'es-AR-TomasNeural', label: 'Tomás', locale: 'es-AR', gender: 'male', accent: 'Argentina', description: 'Narración neutra AR' },
  { id: 'es-CO-SalomeNeural', label: 'Salomé', locale: 'es-CO', gender: 'female', accent: 'Colombia', description: 'Suave y clara' },
  { id: 'es-CO-GonzaloNeural', label: 'Gonzalo', locale: 'es-CO', gender: 'male', accent: 'Colombia', description: 'Formal y limpia' },
  { id: 'en-US-JennyNeural', label: 'Jenny', locale: 'en-US', gender: 'female', accent: 'US', description: 'Friendly US English' },
  { id: 'en-US-GuyNeural', label: 'Guy', locale: 'en-US', gender: 'male', accent: 'US', description: 'Conversational male' },
  { id: 'en-US-AriaNeural', label: 'Aria', locale: 'en-US', gender: 'female', accent: 'US', description: 'News-style clarity' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia', locale: 'en-GB', gender: 'female', accent: 'UK', description: 'British English' },
  { id: 'en-GB-RyanNeural', label: 'Ryan', locale: 'en-GB', gender: 'male', accent: 'UK', description: 'British narrator' },
];

/** Premade multilingual voices suitable for Spanish narration. */
export const ELEVENLABS_TTS_VOICES: TtsVoiceOption[] = [
  {
    id: 'XrExE9yKIg1WjnnlVkGX',
    label: 'Matilda',
    locale: 'multilingual',
    gender: 'female',
    accent: 'Multilingual',
    description: 'Warm documentary narrator',
  },
  {
    id: 'eHAEFkimnYz57pupUMcq',
    label: 'Matilda (alt)',
    locale: 'multilingual',
    gender: 'female',
    accent: 'Multilingual',
    description: 'Alternate Matilda character',
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    label: 'Sarah',
    locale: 'multilingual',
    gender: 'female',
    accent: 'Multilingual',
    description: 'Soft and professional',
  },
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    label: 'Rachel',
    locale: 'multilingual',
    gender: 'female',
    accent: 'Multilingual',
    description: 'Clear news-style delivery',
  },
  {
    id: 'AZnzlk1XvdvUeBnXmlld',
    label: 'Domi',
    locale: 'multilingual',
    gender: 'female',
    accent: 'Multilingual',
    description: 'Strong and confident',
  },
  {
    id: 'ErXwobaYiN019PkySvjV',
    label: 'Antoni',
    locale: 'multilingual',
    gender: 'male',
    accent: 'Multilingual',
    description: 'Well-rounded male narrator',
  },
  {
    id: 'VR6AewLTigWG4xSOukaG',
    label: 'Arnold',
    locale: 'multilingual',
    gender: 'male',
    accent: 'Multilingual',
    description: 'Crisp and authoritative',
  },
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    label: 'Adam',
    locale: 'multilingual',
    gender: 'male',
    accent: 'Multilingual',
    description: 'Deep storytelling voice',
  },
  {
    id: 'yoZ06aMxZJJ28mfd3POQ',
    label: 'Sam',
    locale: 'multilingual',
    gender: 'male',
    accent: 'Multilingual',
    description: 'Dynamic and youthful',
  },
  {
    id: 'jBpfuIE2acCO8z3wKNLl',
    label: 'Gigi',
    locale: 'multilingual',
    gender: 'female',
    accent: 'Multilingual',
    description: 'Animated and expressive',
  },
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
