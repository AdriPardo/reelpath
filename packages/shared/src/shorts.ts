import type { ChannelConfig } from './types.js';

export type ShortsMode = NonNullable<ChannelConfig['shortsMode']>;

/** Techo duro de YouTube Shorts (3 min). */
export const YOUTUBE_SHORTS_HARD_MAX_SEC = 180;

/** Máx. partes configurables del largo → Shorts. */
export const MAX_LONG_SHORTS_FROM_VIDEO = 30;

/** Nº de Shorts por vídeo (1-7) a partir de la config del canal. */
export function resolveShortsPerVideo(raw?: number): number {
  if (!Number.isFinite(raw)) return 1;
  return Math.min(7, Math.max(1, Math.round(raw!)));
}

/** Normaliza cuántas partes del largo; undefined = sin límite explícito (auto). */
export function resolveLongShortsFromVideo(raw?: number): number | undefined {
  if (!Number.isFinite(raw)) return undefined;
  return Math.min(MAX_LONG_SHORTS_FROM_VIDEO, Math.max(1, Math.round(raw!)));
}

/**
 * Cuántas partes cortar del largo.
 * - split sin longShortsFromVideo: undefined (trocea todo el largo por duración)
 * - split con longShortsFromVideo: N partes (cubriendo el largo; puede subir si hace falta)
 * - mixed: longShortsFromVideo ?? 1 (máx. shortsPerVideo)
 */
export function resolveSplitShortsCount(
  config: Pick<ChannelConfig, 'shortsMode' | 'shortsPerVideo' | 'longShortsFromVideo'>,
): number | undefined {
  const fromVideo = resolveLongShortsFromVideo(config.longShortsFromVideo);
  if (config.shortsMode === 'mixed') {
    const requested = resolveShortsPerVideo(config.shortsPerVideo);
    const splitCount = fromVideo ?? 1;
    return Math.min(requested, Math.max(1, splitCount));
  }
  if (config.shortsMode === 'split') {
    return fromVideo;
  }
  return undefined;
}

/**
 * Reparto en modo mixto: N cortes del largo + teasers dedicados hasta shortsPerVideo.
 * Por defecto 1 corte del largo; con longShortsFromVideo=3 y shortsPerVideo=3 → 3 cortes, 0 teasers.
 */
export function resolveMixedShortsCounts(
  config: Pick<ChannelConfig, 'shortsPerVideo' | 'longShortsFromVideo'>,
): {
  splitCount: number;
  dedicatedCount: number;
  total: number;
} {
  const requested = resolveShortsPerVideo(config.shortsPerVideo);
  const splitCount = resolveSplitShortsCount({ ...config, shortsMode: 'mixed' }) ?? 1;
  const dedicatedCount = Math.max(0, requested - splitCount);
  return { splitCount, dedicatedCount, total: splitCount + dedicatedCount };
}

/** Clips `short_source` esperados según el modo (sin depender de la duración del largo). */
export function expectedDedicatedOrMixedShortCount(
  config: Pick<ChannelConfig, 'shortsMode' | 'shortsPerVideo' | 'longShortsFromVideo'>,
): number {
  if (config.shortsMode === 'mixed') {
    return resolveMixedShortsCounts(config).total;
  }
  if (config.shortsMode === 'dedicated') {
    return resolveShortsPerVideo(config.shortsPerVideo);
  }
  return 0;
}

/** Reparte `totalSec` en `parts` duraciones contiguas que suman exactamente el total. */
export function splitEvenly(totalSec: number, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts));
  if (!(totalSec > 0)) return [];
  const durations: number[] = [];
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      durations.push(Math.round((totalSec - allocated) * 1000) / 1000);
    } else {
      const d = Math.round((totalSec / n) * 1000) / 1000;
      durations.push(d);
      allocated += d;
    }
  }
  return durations;
}

/**
 * Plan de duraciones para trocear un largo en Shorts.
 * - Tantos clips como haga falta para no pasar del soft-max (`maxSec + minTailSec`).
 * - Si el resto sería ridículo, prefiere menos clips algo más largos (hasta soft-max).
 */
export function planSegmentDurations(
  totalSec: number,
  maxSec: number,
  minTailSec = 15,
): number[] {
  if (!(totalSec > 0)) return [];
  const target = Math.max(1, maxSec);
  const softMax = target + Math.max(0, minTailSec);

  // Un solo Short algo más largo si cabe en soft-max.
  if (totalSec <= softMax) return [totalSec];

  // Mínimo de partes permitiendo overshoot suave; cubre el vídeo entero.
  const parts = Math.max(1, Math.ceil(totalSec / softMax));
  return splitEvenly(totalSec, parts);
}

export interface ShortClipSegment {
  startSec: number;
  durationSec: number;
}

export interface PlanShortClipSegmentsOptions {
  /** Límite preferido de partes. Si hace falta más para respetar hard-max, se sube. */
  maxParts?: number;
  /**
   * true (split): cubre todo el vídeo con partes contiguas.
   * false (mixed): muestreo distribuido de clips ~maxSec.
   */
  coverFullVideo?: boolean;
  /** Techo absoluto por clip (default: max(maxSec, YouTube 180s)). */
  hardMaxSec?: number;
  minTailSec?: number;
}

function durationsToSegments(durations: number[]): ShortClipSegment[] {
  let startSec = 0;
  return durations.map((durationSec) => {
    const seg = { startSec, durationSec };
    startSec += durationSec;
    return seg;
  });
}

/** Selecciona N segmentos distribuidos a lo largo del plan completo (inicio…final). */
function selectDistributedSegments(
  allDurations: number[],
  maxParts: number,
): ShortClipSegment[] {
  if (maxParts >= allDurations.length) {
    return durationsToSegments(allDurations);
  }

  const indices: number[] = [];
  for (let i = 0; i < maxParts; i++) {
    const idx =
      maxParts === 1 ? 0 : Math.round((i * (allDurations.length - 1)) / (maxParts - 1));
    indices.push(idx);
  }
  const uniqueIndices = [...new Set(indices)].sort((a, b) => a - b);

  let cursor = 0;
  const starts: number[] = [];
  for (const d of allDurations) {
    starts.push(cursor);
    cursor += d;
  }

  return uniqueIndices.map((idx) => ({
    startSec: starts[idx]!,
    durationSec: allDurations[idx]!,
  }));
}

/**
 * Plan final de cortes: cubre el largo entero en modo split, o N highlights en mixed.
 * Si `maxParts` no basta para respetar el techo duro, crea tantos Shorts como haga falta.
 */
export function planShortClipSegments(
  totalSec: number,
  maxSec: number,
  options?: PlanShortClipSegmentsOptions,
): ShortClipSegment[] {
  if (!(totalSec > 0)) return [];
  const target = Math.max(1, maxSec);
  const minTailSec = options?.minTailSec ?? 15;
  const hardMax = Math.max(1, options?.hardMaxSec ?? Math.max(target, YOUTUBE_SHORTS_HARD_MAX_SEC));
  const coverFullVideo = options?.coverFullVideo !== false;

  const natural = planSegmentDurations(totalSec, target, minTailSec);
  const minPartsForHardMax = Math.max(1, Math.ceil(totalSec / hardMax));

  if (options?.maxParts == null) {
    // Auto: tantos como haga falta (soft-max); si aún así algún clip > hardMax, repartir más.
    if (natural.some((d) => d > hardMax + 0.05)) {
      return durationsToSegments(splitEvenly(totalSec, minPartsForHardMax));
    }
    return durationsToSegments(natural);
  }

  const preferred = Math.max(1, Math.floor(options.maxParts));

  if (!coverFullVideo) {
    // Mixto / highlights: N clips ~target, sin cubrir obligatoriamente todo.
    const sampled = selectDistributedSegments(natural, preferred);
    return sampled.map((seg) => ({
      ...seg,
      durationSec: Math.min(seg.durationSec, hardMax),
    }));
  }

  // Split con N preferido: cubrir TODO el vídeo. Subir N si hace falta por hard-max.
  const parts = Math.max(preferred, minPartsForHardMax);
  return durationsToSegments(splitEvenly(totalSec, parts));
}

/** Número de partes de Short esperadas para un vídeo de `durationSec`. */
export function expectedShortsPartCount(
  durationSec: number,
  maxPartSec: number,
  options?: PlanShortClipSegmentsOptions,
): number {
  return planShortClipSegments(durationSec, maxPartSec, options).length;
}
