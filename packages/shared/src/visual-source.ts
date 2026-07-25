import type { ChannelConfig, ScriptScene, VisualSource, VisualSourceMode } from './types.js';

export type { VisualSourceMode };

/** Modo visual del canal (default: mixto stock + IA). */
export function resolveVisualSourceMode(config: ChannelConfig): VisualSourceMode {
  return config.visualSourceMode ?? 'mixed';
}

/** ¿Esta escena debe intentar stock (vídeo/foto) antes que imagen IA? */
export function sceneWantsStock(
  sceneIndex: number,
  mode: VisualSourceMode,
  sceneOverride?: VisualSource,
): boolean {
  if (sceneOverride === 'stock') return true;
  if (sceneOverride === 'image') return false;
  if (mode === 'stock') return true;
  if (mode === 'mixed') return sceneIndex % 2 === 0;
  return false;
}

/** Aplica preferredVisualSource a escenas según el modo del canal. */
export function applyVisualSourceToScenes(
  scenes: ScriptScene[],
  config: ChannelConfig,
): ScriptScene[] {
  const mode = resolveVisualSourceMode(config);
  if (mode === 'image') return scenes;

  return scenes.map((scene) => ({
    ...scene,
    preferredVisualSource: sceneWantsStock(scene.index, mode, scene.preferredVisualSource)
      ? 'stock'
      : 'image',
  }));
}

/** Instrucciones extra para el LLM cuando el canal usa stock B-roll. */
export function getStockVisualScriptHints(mode: VisualSourceMode): string {
  if (mode === 'image') return '';

  const base =
    `\n\nVISUALES STOCK (metraje real — Pexels):\n` +
    `- visualPrompt = 3-6 palabras clave en INGLÉS para buscar clips de vídeo (ej: "busy city street night", "hands signing contract", "aerial forest river").\n` +
    `- Describe acciones y lugares filmables; evita escenas imposibles, texto en pantalla o personajes históricos concretos.\n` +
    `- Cada escena debe tener keywords DISTINTAS.\n` +
    `- NO uses "cinematic", "dramatic lighting" ni descripciones de estilo IA.`;

  if (mode === 'mixed') {
    return (
      base +
      `\n- En modo mixto: alterna entre keywords de stock (escenas pares) y descripciones más artísticas para IA (escenas impares).`
    );
  }

  return base + `\n- Todas las escenas usarán clips de stock; prioriza keywords concretas y variadas.`;
}
