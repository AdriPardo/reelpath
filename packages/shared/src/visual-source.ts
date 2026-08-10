import type { ChannelConfig, ScriptScene, VisualSource, VisualSourceMode } from './types.js';
import { getVisualPromptGenerationRules } from './prompt-visual.js';

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

/**
 * Instrucciones extra para el LLM según modo visual del canal.
 * Código siempre-on (no depende de re-seed de plantillas DB).
 */
export function getStockVisualScriptHints(mode: VisualSourceMode): string {
  return `\n\n${getVisualPromptGenerationRules(mode)}`;
}
