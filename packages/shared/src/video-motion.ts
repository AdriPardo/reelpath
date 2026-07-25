import type { MotionPreset, TransitionPreset, VideoMotionIntensity } from './types.js';

const MOTION_PRESETS: MotionPreset[] = [
  'push-in',
  'pull-out',
  'pan-left',
  'pan-right',
  'drift-up',
  'drift-down',
];

const UPWARD_HINTS = /(cielo|montañ|torre|ascen|sube|elev|vuelo|alto|altar|cúpula)/i;
const DOWNWARD_HINTS = /(abajo|cae|caída|profund|pozo|subterr|foso|tumba|suelo)/i;
const LEFT_HINTS = /(oeste|izquierda|regreso|pasado|origen|retrocede|retroceso)/i;
const RIGHT_HINTS = /(este|derecha|avance|futuro|destino|camino|ruta|viaje)/i;
const PULL_OUT_HINTS = /(multitud|panorama|ciudad|imperio|conjunto|global|mapa|ejército)/i;
const PUSH_IN_HINTS = /(rostro|detalle|secreto|documento|símbolo|anillo|carta|mirada|manos)/i;

const INTENSITY_MULTIPLIER: Record<VideoMotionIntensity, number> = {
  subtle: 0.72,
  normal: 1,
  dynamic: 1.35,
};

const TRANSITION_CYCLE: TransitionPreset[] = [
  'fade',
  'slide-left',
  'fade',
  'blur',
  'dip-to-black',
  'slide-right',
];

export interface MotionFilterParams {
  zoomRate: number;
  maxZoom: number;
  travelZoom: number;
  startZoom: number;
}

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickFromHash(sceneIndex: number, text: string, exclude?: MotionPreset): MotionPreset {
  const hash = stableHash(`${sceneIndex}:${text}`);
  const pool = exclude ? MOTION_PRESETS.filter((p) => p !== exclude) : MOTION_PRESETS;
  return pool[hash % pool.length] ?? 'push-in';
}

/** Ajusta intensidad según gancho (escena 1), duración y preferencia del canal. */
export function resolveSceneMotionIntensity(params: {
  sceneIndex: number;
  durationSec: number;
  channelIntensity?: VideoMotionIntensity;
  retentionMode?: boolean;
}): VideoMotionIntensity {
  const base = params.channelIntensity ?? (params.retentionMode ? 'dynamic' : 'normal');

  if (params.sceneIndex <= 1) {
    if (base === 'subtle') return 'normal';
    return 'dynamic';
  }

  if (params.durationSec >= 10) {
    if (base === 'dynamic') return 'normal';
    return 'subtle';
  }

  if (params.durationSec >= 7 && base === 'dynamic') {
    return 'normal';
  }

  return base;
}

export function getMotionFilterParams(
  intensity: VideoMotionIntensity,
  retentionMode: boolean,
  durationSec: number,
): MotionFilterParams {
  const retentionBoost = retentionMode ? 1.2 : 1;
  const durationFactor =
    durationSec >= 10 ? 0.75 : durationSec >= 7 ? 0.88 : durationSec <= 3 ? 1.15 : 1;
  const mult = INTENSITY_MULTIPLIER[intensity] * retentionBoost * durationFactor;

  const baseZoomRate = retentionMode ? 0.0016 : 0.0012;
  const baseMaxZoom = retentionMode ? 1.1 : 1.08;
  const baseTravelZoom = retentionMode ? 1.09 : 1.07;
  const baseStartZoom = retentionMode ? 1.08 : 1.06;

  return {
    zoomRate: Number((baseZoomRate * mult).toFixed(6)),
    maxZoom: Number(Math.min(1.18, baseMaxZoom + (mult - 1) * 0.04).toFixed(4)),
    travelZoom: Number(Math.min(1.15, baseTravelZoom + (mult - 1) * 0.03).toFixed(4)),
    startZoom: Number(Math.min(1.14, baseStartZoom + (mult - 1) * 0.03).toFixed(4)),
  };
}

export function inferMotionPreset(params: {
  sceneIndex: number;
  narration?: string;
  visualPrompt?: string;
  previousPreset?: MotionPreset;
  durationSec?: number;
  videoMotionIntensity?: VideoMotionIntensity;
  retentionMode?: boolean;
}): MotionPreset {
  const text = `${params.narration ?? ''} ${params.visualPrompt ?? ''}`.trim();

  let candidate: MotionPreset | null = null;

  if (UPWARD_HINTS.test(text)) candidate = 'drift-up';
  else if (DOWNWARD_HINTS.test(text)) candidate = 'drift-down';
  else if (LEFT_HINTS.test(text)) candidate = 'pan-left';
  else if (RIGHT_HINTS.test(text)) candidate = 'pan-right';
  else if (PULL_OUT_HINTS.test(text)) candidate = 'pull-out';
  else if (PUSH_IN_HINTS.test(text)) candidate = 'push-in';

  if (!candidate && params.sceneIndex <= 1) {
    candidate = params.sceneIndex === 0 ? 'push-in' : 'pan-right';
  }

  if (!candidate) {
    candidate = pickFromHash(params.sceneIndex, text);
  }

  if (params.previousPreset && candidate === params.previousPreset) {
    candidate = pickFromHash(params.sceneIndex + 1, text, params.previousPreset);
  }

  return candidate;
}

export function inferTransitionPreset(
  sceneIndex: number,
  scriptTransition?: TransitionPreset,
): TransitionPreset {
  if (scriptTransition) return scriptTransition;
  return TRANSITION_CYCLE[sceneIndex % TRANSITION_CYCLE.length] ?? 'fade';
}

/** Mapea preset de transición a nombre xfade de FFmpeg. */
export function mapTransitionToFfmpeg(preset: TransitionPreset | undefined): string {
  switch (preset) {
    case 'dip-to-black':
      return 'fadeblack';
    case 'slide-left':
      return 'slideleft';
    case 'slide-right':
      return 'slideright';
    case 'blur':
      // xfade no tiene blur; dissolve da un blend suave similar
      return 'dissolve';
    case 'fade':
    default:
      return 'fade';
  }
}
