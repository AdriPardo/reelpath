import type { ChannelConfig, VideoFormat } from './types.js';

/** Max characters per subtitle phrase in retention mode (mobile-readable). */
export const RETENTION_PHRASE_MAX_LEN = 28;

export const RETENTION_KEN_BURNS = { zoomRate: 0.0024, maxZoom: 1.09 } as const;
export const NORMAL_KEN_BURNS = { zoomRate: 0.0012, maxZoom: 1.06 } as const;

export function isHistoryNiche(niche: string): boolean {
  return /historia|históric|curiosidad|antig|misterio|arqueolog|medieval|imperio|civilizaci/i.test(
    niche,
  );
}

export function buildChannelPromptContext(config: ChannelConfig): string {
  const parts: string[] = [];
  if (config.brandName?.trim()) parts.push(`Marca/canal: ${config.brandName.trim()}.`);
  if (config.tone?.trim()) parts.push(`Tono narrativo: ${config.tone.trim()}.`);
  if (config.targetAudience?.trim()) parts.push(`Audiencia: ${config.targetAudience.trim()}.`);
  if (config.forbiddenTopics?.length) {
    parts.push(`PROHIBIDO cubrir: ${config.forbiddenTopics.join(', ')}.`);
  }
  if (config.customPromptHints?.trim()) {
    parts.push(`Instrucciones del operador: ${config.customPromptHints.trim()}`);
  }
  return parts.length ? `\n\nCONTEXTO DEL CANAL:\n${parts.join('\n')}` : '';
}

/** High-performing topic angles for history/curiosity channels (Saberes-style). */
export function getHistoryViralTopicAngles(): string {
  return `ÁNGULOS VIRALES PROBADOS (historia/curiosidades — inspiración, no copiar literal):
- Personaje olvidado que cambió la historia: "El médico que inventó la anestesia y murió en la pobreza"
- Paradoja imposible: "El imperio que cayó por un error de traducción en un tratado"
- Secreto de poder: "Lo que los emperadores romanos ocultaban sobre su salud mental"
- Hecho que parece inventado: "El tratado de paz firmado tres días después de la muerte del rey"
- Misterio bien acotado: "La ciudad que desapareció en una noche sin dejar rastro arqueológico"
- Conexión moderna: "El origen medieval de la palabra que usas cada día"
- Contradicción histórica: "El científico que demostró que tenían razón quienes lo persiguieron"
- Decisión absurda con consecuencias: "El general que ganó la batalla siguiendo el consejo de un soñador"

EVITAR clickbait vacío: "No vas a creer", "Te sorprenderá", "Top 5", "Datos que no sabías" sin persona/lugar/año concreto.
PREFERIR: sujeto + época/lugar + giro específico en title y hook.`;
}

export function getRetentionIdeaHints(): string {
  return `MODO RETENCIÓN (optimizar watch time):
- hook debe parar el scroll en <2 segundos: contradicción, número imposible o pregunta directa
- PROHIBIDO hooks lentos: "En este vídeo...", "Hoy hablaremos de...", "¿Te gusta la historia?"
- title clickeable con especificidad (persona, año, lugar) — no genérico
- angle = el giro que justifica ver hasta el final
- Usa paradojas verificables, no sensacionalismo vacío`;
}

export function getRetentionScriptHints(format: VideoFormat): string {
  if (format === 'shorts') {
    return `MODO RETENCIÓN — SHORTS (crítico):
1. ESCENA 1 (primeros 3 segundos): pattern-interrupt — pregunta imposible, dato que contradiga creencias, o "Nadie sabe que...". PROHIBIDO intros lentas.
2. ESCENAS intermedias: contexto rápido + revelación; máximo 12 palabras; visualPrompt único por escena.
3. ESCENA FINAL: cliffhanger, pregunta abierta, o teaser "la parte más oscura… en el próximo vídeo".
4. TTS: comas para pausas dramáticas; énfasis en palabras clave.
5. visualPrompt: escena concreta distinta en cada corte — jamás repetir descripción genérica.`;
  }

  return `MODO RETENCIÓN — DOCUMENTAL LARGO (suavizado):
1. ESCENA 1 (≤5 segundos): pattern-interrupt brutal — pregunta imposible, dato que contradiga creencias o "Nadie sabe que…". PROHIBIDO "bienvenidos", "hoy vamos a".
2. Cada 2-3 escenas: micro-gancho o dato sorprendente ("Pero aquí viene lo extraño…", "Lo que nadie esperaba…").
3. ESCENA FINAL: pregunta retórica, reflexión con gancho o teaser suave — NO despedida larga ni cliffhanger estilo Shorts forzado.
   Ejemplos válidos para documental largo:
   - "¿Y si todo lo que creías saber fuera solo la mitad de la historia?"
   - "La pregunta que queda es: ¿quién tenía realmente la razón?"
   - "Hoy todavía debatimos si aquella decisión fue un error o el único camino posible."
4. visualPrompt único y específico por escena; alternar planos (detalle, panorama, personaje).
5. TTS: ritmo documental con comas estratégicas; escena 1 ≤20 palabras.`;
}

export function getRetentionViralGuidelines(): string {
  return `- Prioriza hooks con contradicción o cifra sorprendente en las primeras 5 palabras
- Penaliza ideas con hooks genéricos, listas o educativos blandos
- trendAlignment ≥0.88 cuando el ángulo encaje con tendencias del nicho
- El angle debe prometer un giro concreto, no un tema vago`;
}
