import type { ChannelConfig } from './types.js';

export type ShortsMode = NonNullable<ChannelConfig['shortsMode']>;

/** Nº de Shorts por vídeo (1-7) a partir de la config del canal. */
export function resolveShortsPerVideo(raw?: number): number {
  if (!Number.isFinite(raw)) return 1;
  return Math.min(7, Math.max(1, Math.round(raw!)));
}

/** Normaliza cuántas partes del largo (1-3); undefined = sin límite explícito. */
export function resolveLongShortsFromVideo(raw?: number): number | undefined {
  if (!Number.isFinite(raw)) return undefined;
  return Math.min(3, Math.max(1, Math.round(raw!)));
}

/**
 * Cuántas partes cortar del largo.
 * - split sin longShortsFromVideo: undefined (trocea todo el largo por duración)
 * - split con longShortsFromVideo: N partes distribuidas
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
