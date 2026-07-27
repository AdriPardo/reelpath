/** Resoluciones objetivo de exportación. */
export const VIDEO_RESOLUTION_LONG = { width: 1920, height: 1080 } as const;
export const VIDEO_RESOLUTION_SHORT = { width: 1080, height: 1920 } as const;

/** CRF más bajo = mejor calidad (18 ≈ visually lossless para YouTube). */
export const FFMPEG_VIDEO_CRF = 18;
/** Preset legacy (solo referencia). El runtime usa getFfmpegVideoPreset(). */
export const FFMPEG_VIDEO_PRESET = 'veryfast' as const;
export const FFMPEG_AUDIO_BITRATE = '192k';

/** Threads x264/filtros por defecto en VPS ~4–8 vCPU (evita saturar todos los cores). */
export const FFMPEG_THREADS_DEFAULT = 2;
/** Encodes FFmpeg simultáneos por proceso (1 = serializar; seguro en CPX32). */
export const FFMPEG_CONCURRENCY_DEFAULT = 1;

/**
 * Threads para libx264 y filtros (`FFMPEG_THREADS`).
 * Default 2 en VPS pequeño. `0` = dejar que FFmpeg elija (todos los cores).
 */
export function getFfmpegThreads(): number {
  const raw = process.env.FFMPEG_THREADS;
  if (raw !== undefined && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return FFMPEG_THREADS_DEFAULT;
}

/**
 * Máximo de procesos ffmpeg concurrentes en este proceso (`FFMPEG_CONCURRENCY`).
 * Default 1: serializa escenas/overlays/shorts aunque WORKER_CONCURRENCY>1.
 */
export function getFfmpegConcurrency(): number {
  const raw = process.env.FFMPEG_CONCURRENCY;
  if (raw !== undefined && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  return FFMPEG_CONCURRENCY_DEFAULT;
}

/**
 * `nice` Unix para bajar prioridad CPU del encode (`FFMPEG_NICE`, p.ej. 10).
 * Sin definir o 0 = sin nice.
 */
export function getFfmpegNice(): number | null {
  const raw = process.env.FFMPEG_NICE;
  if (raw === undefined || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(19, Math.floor(n));
}

/**
 * Preset x264: `veryfast` por defecto (VPS). Override con `FFMPEG_PRESET`.
 * Tradeoff: veryfast ≈ 3–4× más rápido que medium; calidad ligeramente menor.
 * Para máxima calidad local: `FFMPEG_PRESET=medium`.
 */
export function getFfmpegVideoPreset(): string {
  if (process.env.FFMPEG_PRESET?.trim()) return process.env.FFMPEG_PRESET.trim();
  return 'veryfast';
}

/** CRF configurable vía FFMPEG_CRF (default 18). En VPS apretado probar 20–22. */
export function getFfmpegVideoCrf(): number {
  const raw = process.env.FFMPEG_CRF;
  if (raw !== undefined) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return FFMPEG_VIDEO_CRF;
}

/**
 * Flags de scale FFmpeg (`FFMPEG_SCALE_FLAGS`).
 * Default `bicubic` (mucho más barato en CPU que `lanczos`).
 * Nitidez máxima: `FFMPEG_SCALE_FLAGS=lanczos`.
 */
export function getFfmpegScaleFlags(): string {
  if (process.env.FFMPEG_SCALE_FLAGS?.trim()) return process.env.FFMPEG_SCALE_FLAGS.trim();
  return 'bicubic';
}

/**
 * Filtro `noise` (film grain) es muy caro en CPU.
 * Off por defecto; activar con `FFMPEG_ENABLE_FILM_GRAIN=true`.
 */
export function isFfmpegFilmGrainEnabled(): boolean {
  return process.env.FFMPEG_ENABLE_FILM_GRAIN === 'true';
}

/** Tope de bitrate para evitar picos de compresión en escenas complejas. */
export const FFMPEG_VIDEO_MAXRATE = '12M';
export const FFMPEG_VIDEO_BUFSIZE = '24M';

export function buildLanczosScaleCrop(width: number, height: number): string {
  const flags = getFfmpegScaleFlags();
  return (
    `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=${flags},` +
    `crop=${width}:${height},setsar=1`
  );
}

/** Escala con margen para Ken Burns / zoompan sin perder nitidez al hacer zoom. */
export function buildMotionScaleCrop(width: number, height: number, zoomHeadroom: number): string {
  const preW = Math.ceil(width * zoomHeadroom);
  const preH = Math.ceil(height * zoomHeadroom);
  return buildLanczosScaleCrop(preW, preH);
}

export function ffmpegH264EncodeArgs(options?: {
  audioCopy?: boolean;
  audioBitrate?: string;
  /** Solo vídeo (p. ej. normalizar stock con -an). */
  videoOnly?: boolean;
}): string[] {
  const audio = options?.videoOnly
    ? ([] as const)
    : options?.audioCopy
      ? (['-c:a', 'copy'] as const)
      : (['-c:a', 'aac', '-b:a', options?.audioBitrate ?? FFMPEG_AUDIO_BITRATE] as const);

  const threads = getFfmpegThreads();
  const threadArgs = threads > 0 ? (['-threads', String(threads)] as const) : ([] as const);

  return [
    '-c:v',
    'libx264',
    '-preset',
    getFfmpegVideoPreset(),
    '-crf',
    String(getFfmpegVideoCrf()),
    '-maxrate',
    FFMPEG_VIDEO_MAXRATE,
    '-bufsize',
    FFMPEG_VIDEO_BUFSIZE,
    ...threadArgs,
    ...audio,
  ];
}
