import fs from 'node:fs/promises';
import {
  effectiveCoverrApiKey,
  effectivePexelsApiKey,
  effectivePixabayApiKey,
  loadEffectiveConfig,
} from '@autotube/config';
import type { ChannelConfig } from '@autotube/shared';
import { listBgmFiles, shouldUseBgm } from '@autotube/video-renderer';

export interface PipelinePreflightResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Cheap checks before spending LLM/TTS/render cost (MPT task preflight idea).
 */
export async function runPipelinePreflight(
  config: ChannelConfig,
): Promise<PipelinePreflightResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cfg = loadEffectiveConfig();

  const visualMode = config.visualSourceMode ?? 'mixed';
  if (visualMode === 'stock' || visualMode === 'mixed') {
    const hasStockKey =
      !!effectivePexelsApiKey()?.trim() ||
      !!effectivePixabayApiKey()?.trim() ||
      !!effectiveCoverrApiKey()?.trim();
    if (!hasStockKey) {
      if (visualMode === 'stock') {
        errors.push(
          'visualSourceMode=stock sin PEXELS/PIXABAY/COVERR API key — configura Secretos o .env',
        );
      } else {
        warnings.push(
          'modo mixed sin API stock — escenas stock caerán a IA/placeholder',
        );
      }
    }
  }

  if (shouldUseBgm({ enabled: config.bgmEnabled, volume: config.bgmVolume })) {
    const tracks = await listBgmFiles();
    if (tracks.length === 0) {
      warnings.push(
        'bgmEnabled=true pero no hay tracks en resource/bgm ni storage/bgm — se omitirá BGM',
      );
    } else if (config.bgmFile?.trim()) {
      const base = config.bgmFile.trim().split(/[/\\]/).pop();
      const found = tracks.some((t) => t.endsWith(`/${base}`) || t.endsWith(`\\${base}`));
      if (!found) {
        warnings.push(`bgmFile="${config.bgmFile}" no encontrado — se usará track aleatorio`);
      }
    }
  }

  const hasTts =
    cfg.TTS_ENABLE_EDGE ||
    !!cfg.ELEVENLABS_API_KEY?.trim() ||
    !!cfg.OPENAI_API_KEY?.trim() ||
    cfg.MOCK_EXTERNAL_APIS;
  if (!hasTts) {
    errors.push('Sin provider TTS usable (Edge/ElevenLabs/OpenAI) y MOCK_EXTERNAL_APIS=false');
  }

  // Touch storage root early to surface permission issues.
  try {
    await fs.access(cfg.STORAGE_PATH);
  } catch {
    warnings.push(`STORAGE_PATH no accesible aún: ${cfg.STORAGE_PATH}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}
