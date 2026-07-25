/** Resoluciones objetivo de exportación. */
export const VIDEO_RESOLUTION_LONG = { width: 1920, height: 1080 } as const;
export const VIDEO_RESOLUTION_SHORT = { width: 1080, height: 1920 } as const;

/** CRF más bajo = mejor calidad (18 ≈ visually lossless para YouTube). */
export const FFMPEG_VIDEO_CRF = 18;
export const FFMPEG_VIDEO_PRESET = 'medium' as const;
export const FFMPEG_AUDIO_BITRATE = '192k';

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Preset x264: `fast` en prod por defecto, `medium` en dev. Override con FFMPEG_PRESET. */
export function getFfmpegVideoPreset(): string {
  if (process.env.FFMPEG_PRESET?.trim()) return process.env.FFMPEG_PRESET.trim();
  return isProductionEnv() ? 'fast' : 'medium';
}

/** CRF configurable vía FFMPEG_CRF (default 18). */
export function getFfmpegVideoCrf(): number {
  const raw = process.env.FFMPEG_CRF;
  if (raw !== undefined) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return FFMPEG_VIDEO_CRF;
}

/** Tope de bitrate para evitar picos de compresión en escenas complejas. */
export const FFMPEG_VIDEO_MAXRATE = '12M';
export const FFMPEG_VIDEO_BUFSIZE = '24M';

export function buildLanczosScaleCrop(width: number, height: number): string {
  return (
    `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,` +
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
}): string[] {
  const audio = options?.audioCopy
    ? (['-c:a', 'copy'] as const)
    : (['-c:a', 'aac', '-b:a', options?.audioBitrate ?? FFMPEG_AUDIO_BITRATE] as const);

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
    ...audio,
  ];
}
