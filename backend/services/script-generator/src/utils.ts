import type { ChannelConfig, ScriptScene } from '@autotube/shared';
import { loadConfig } from '@autotube/config';

export function sceneOptions(config: ChannelConfig) {
  return { retentionMode: config.retentionMode ?? false };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function normalizeScenes(scenes: ScriptScene[]): ScriptScene[] {
  return scenes.map((s, i) => ({
    index: i,
    narration: s.narration,
    visualPrompt: s.visualPrompt,
    durationSec: s.durationSec ?? countWords(s.narration) * 0.45,
    preferredVisualSource: s.preferredVisualSource,
    transitionPreset: s.transitionPreset,
  }));
}

export function parseRawScenes(scenesRaw: Array<Record<string, unknown>>): ScriptScene[] {
  return scenesRaw.map((s, i) => ({
    index: i,
    narration: String(s.narration ?? s.text ?? ''),
    visualPrompt: String(s.visualPrompt ?? s.visual ?? ''),
    durationSec: Number(s.durationSec ?? s.duration ?? 30),
    preferredVisualSource:
      s.preferredVisualSource === 'stock' || s.preferredVisualSource === 'image'
        ? s.preferredVisualSource
        : undefined,
  }));
}

export function resolveScriptGenerationMode(
  config: ChannelConfig,
): 'monolithic' | 'chunked' {
  if (config.scriptGenerationMode) return config.scriptGenerationMode;
  const envMode = loadConfig().SCRIPT_GENERATION_MODE;
  if (envMode) return envMode;
  return config.videoFormat === 'long' ? 'chunked' : 'monolithic';
}

export function totalSceneWords(scenes: ScriptScene[]): number {
  return scenes.reduce((sum, s) => sum + countWords(s.narration), 0);
}

export function sceneWordSummary(scenes: ScriptScene[]): string {
  return `${scenes.length} scenes, ${totalSceneWords(scenes)} words`;
}
