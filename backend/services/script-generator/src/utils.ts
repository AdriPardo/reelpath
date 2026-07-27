import type { ChannelConfig, ScriptScene } from '@autotube/shared';
import { loadConfig } from '@autotube/config';

export function sceneOptions(config: ChannelConfig) {
  return { retentionMode: config.retentionMode ?? false };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function durationSecFromNarration(narration: string, fallback?: number): number {
  const fromWords = countWords(narration) * 0.45;
  if (fallback == null || !Number.isFinite(fallback) || fallback <= 0) {
    return fromWords;
  }
  // Never keep an LLM duration shorter than the spoken-word estimate.
  return Math.max(fallback, fromWords);
}

export function normalizeScenes(scenes: ScriptScene[]): ScriptScene[] {
  return scenes.map((s, i) => ({
    index: i,
    narration: s.narration,
    visualPrompt: s.visualPrompt,
    durationSec: durationSecFromNarration(s.narration, s.durationSec),
    preferredVisualSource: s.preferredVisualSource,
    transitionPreset: s.transitionPreset,
  }));
}

export function parseRawScenes(scenesRaw: Array<Record<string, unknown>>): ScriptScene[] {
  return scenesRaw.map((s, i) => {
    const narration = String(s.narration ?? s.text ?? '');
    const rawDuration = Number(s.durationSec ?? s.duration ?? 0);
    return {
      index: i,
      narration,
      visualPrompt: String(s.visualPrompt ?? s.visual ?? ''),
      durationSec: durationSecFromNarration(narration, rawDuration),
      preferredVisualSource:
        s.preferredVisualSource === 'stock' || s.preferredVisualSource === 'image'
          ? s.preferredVisualSource
          : undefined,
    };
  });
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
