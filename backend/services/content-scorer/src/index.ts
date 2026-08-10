import type {
  ContentScoreBreakdown,
  ScriptVariant,
  VideoIdeaDTO,
  VideoQualityCheck,
  VideoQualityReport,
} from '@autotube/shared';

const HOOK_POWER_WORDS = [
  'secreto', 'nunca', 'impacto', 'gratis', 'ahora', 'error', 'verdad',
  'increíble', 'prohibido', 'descubre', 'urgente', 'shock',
  'olvidad', 'imposible', 'paradoja', 'mentira', 'ocult', 'misterio',
  'conspir', 'prohibid', 'engañ', 'traición', 'desaparec',
];

const GENERIC_HOOK_PATTERNS = [
  /\b\d+\s+(cosas|curiosidades|datos|hechos|secretos)\b/i,
  /curiosidades (de|del|sobre|que)/i,
  /datos (raros|interesantes|sorprendentes)/i,
  /\bno sabías\b/i,
  /\bte sorprender/i,
  /\bno vas a creer\b/i,
  /\btop\s*\d+/i,
  /\bhechos (históricos|curiosos)\b/i,
];

const SLOW_INTRO_PATTERNS = [
  /^(hoy|en este|bienvenid|vamos a|te contamos|hablaremos|¿te gusta)/i,
];

function scoreAngle(angle: string): number {
  let score = 45;
  const len = angle.trim().length;
  if (len > 25 && len < 160) score += 20;
  if (/\b(porque|pero|giro|resultado|consecuencia|impacto|paradoja|revel)\b/i.test(angle)) {
    score += 15;
  }
  if (/\b(curiosidad interesante|tema genérico|datos varios)\b/i.test(angle)) score -= 15;
  return Math.min(100, score);
}

export function scoreHook(hook: string): number {
  const lower = hook.toLowerCase();
  let score = 40;
  if (hook.length >= 20 && hook.length <= 80) score += 15;
  if (hook.includes('?')) score += 10;
  if (hook.includes('!')) score += 5;
  const powerHits = HOOK_POWER_WORDS.filter((w) => lower.includes(w)).length;
  score += Math.min(powerHits * 8, 24);
  if (/\d/.test(hook)) score += 6;
  if (/\b(siglo|año|antes de Cristo|después de Cristo|\d{3,4})\b/i.test(hook)) score += 8;
  if (/\b(rey|emperador|faraón|papa|general|imperio|dinastía|civilización)\b/i.test(lower)) {
    score += 6;
  }
  if (/\b(pero|sin embargo|a pesar|paradoja|contradice|imposible)\b/i.test(hook)) score += 6;

  for (const pattern of GENERIC_HOOK_PATTERNS) {
    if (pattern.test(hook)) score -= 20;
  }
  for (const pattern of SLOW_INTRO_PATTERNS) {
    if (pattern.test(hook.trim())) score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

export function scoreIdea(idea: Omit<VideoIdeaDTO, 'viralScore' | 'rationale'>): ContentScoreBreakdown {
  const hookStrength = scoreHook(idea.hook);
  const trendAlignment = Math.round(idea.trendAlignment * 100);
  const angleScore = scoreAngle(idea.angle);
  const nicheFit = Math.round(angleScore * 0.6 + (idea.angle.length > 10 ? 40 : 20));
  const seoPotential = idea.title.length >= 30 && idea.title.length <= 70 ? 80 : 55;

  const total = Math.round(
    hookStrength * 0.35 +
      trendAlignment * 0.3 +
      nicheFit * 0.2 +
      seoPotential * 0.15,
  );

  return { hookStrength, trendAlignment, nicheFit, seoPotential, total };
}

export function rankIdeas<T extends Omit<VideoIdeaDTO, 'viralScore'>>(ideas: T[]): Array<T & { viralScore: number; scoreBreakdown: ContentScoreBreakdown }> {
  return ideas
    .map((idea) => {
      const scoreBreakdown = scoreIdea(idea);
      return { ...idea, viralScore: scoreBreakdown.total, scoreBreakdown };
    })
    .sort((a, b) => b.viralScore - a.viralScore);
}

export function selectTopIdea<T extends { viralScore: number }>(ideas: T[], minScore = 0): T | null {
  const top = ideas[0];
  if (!top || top.viralScore < minScore) return null;
  return top;
}

export interface VideoQualityInput {
  script: ScriptVariant;
  format: 'shorts' | 'long';
  durationSec: number;
  filePathExists: boolean;
  hasThumbnail: boolean;
  /** Scene indexes that have an image asset. */
  sceneImageIndexes: number[];
  /** Scene indexes that have an audio asset. */
  sceneAudioIndexes: number[];
  hasSubtitles: boolean;
  title: string;
  description: string;
  forbiddenTopics?: string[];
  minScoreToApprove?: number;
  /** Escenas con audio casi vacío / corrupto. */
  nearSilentAudioCount?: number;
  /** Paths de stock repetidos (mismo clip en varias escenas). */
  repeatedStockCount?: number;
  /** Canal tiene BGM on pero no hay track disponible. */
  bgmEnabledWithoutTrack?: boolean;
  /** Escenas de audio sin WordBoundary (sync de subtítulos peor). */
  missingWordBoundaryCount?: number;
}

const DURATION_RANGES: Record<'shorts' | 'long', { min: number; max: number }> = {
  shorts: { min: 12, max: 90 },
  long: { min: 480, max: 900 },
};

const STATUS_WEIGHT: Record<VideoQualityCheck['status'], number> = {
  pass: 1,
  warn: 0.5,
  fail: 0,
};

/**
 * Revisión automática (QA) de un vídeo renderizado. Comprueba gancho, escenas,
 * media completa, duración, miniatura y cumplimiento, y devuelve un informe con
 * puntuación 0-100. `passed` indica que no hay fallos graves; `autoApproved`
 * indica que además supera el umbral del canal para publicarse sin revisión humana.
 */
export function scoreVideoQuality(input: VideoQualityInput): VideoQualityReport {
  const checks: VideoQualityCheck[] = [];
  const scenes = input.script.scenes ?? [];

  // 1. Gancho
  const hookScore = scoreHook(input.script.hook ?? '');
  checks.push({
    id: 'hook',
    label: 'Gancho inicial',
    status: hookScore >= 60 ? 'pass' : hookScore >= 40 ? 'warn' : 'fail',
    detail:
      hookScore >= 60
        ? `Gancho fuerte (${hookScore}/100).`
        : hookScore >= 40
          ? `Gancho mejorable (${hookScore}/100): añade intriga o un dato concreto.`
          : `Gancho débil (${hookScore}/100): riesgo de perder al espectador en los primeros segundos.`,
  });

  // 2. Escenas con narración
  const emptyNarration = scenes.filter((s) => !s.narration || s.narration.trim().length < 4).length;
  const minScenes = input.format === 'long' ? 5 : 3;
  checks.push({
    id: 'scenes',
    label: 'Escenas y narración',
    status:
      scenes.length >= minScenes && emptyNarration === 0
        ? 'pass'
        : scenes.length >= Math.max(2, minScenes - 1) && emptyNarration === 0
          ? 'warn'
          : 'fail',
    detail:
      emptyNarration > 0
        ? `${emptyNarration} escena(s) sin narración.`
        : `${scenes.length} escenas (mínimo recomendado ${minScenes}).`,
  });

  // 3. Media completa (imagen + audio por escena)
  const imageSet = new Set(input.sceneImageIndexes);
  const audioSet = new Set(input.sceneAudioIndexes);
  const missingImage = scenes.filter((s) => !imageSet.has(s.index)).length;
  const missingAudio = scenes.filter((s) => !audioSet.has(s.index)).length;
  checks.push({
    id: 'media',
    label: 'Imágenes y audio',
    status: missingImage === 0 && missingAudio === 0 ? 'pass' : missingImage + missingAudio <= 1 ? 'warn' : 'fail',
    detail:
      missingImage === 0 && missingAudio === 0
        ? 'Todas las escenas tienen imagen y audio.'
        : `Faltan ${missingImage} imagen(es) y ${missingAudio} audio(s).`,
  });

  // 4. Subtítulos
  checks.push({
    id: 'subtitles',
    label: 'Subtítulos',
    status: input.hasSubtitles ? 'pass' : 'warn',
    detail: input.hasSubtitles
      ? 'Subtítulos generados.'
      : 'Sin subtítulos: reducen la retención en móvil.',
  });

  // 5. Duración
  const range = DURATION_RANGES[input.format];
  const inRange = input.durationSec >= range.min && input.durationSec <= range.max;
  checks.push({
    id: 'duration',
    label: 'Duración',
    status: inRange ? 'pass' : 'warn',
    detail: inRange
      ? `Duración ${Math.round(input.durationSec)}s dentro del rango (${range.min}-${range.max}s).`
      : `Duración ${Math.round(input.durationSec)}s fuera del rango esperado (${range.min}-${range.max}s).`,
  });

  // 6. Archivo renderizado
  checks.push({
    id: 'render',
    label: 'Archivo de vídeo',
    status: input.filePathExists ? 'pass' : 'fail',
    detail: input.filePathExists ? 'Vídeo renderizado correctamente.' : 'No se encontró el archivo de vídeo.',
  });

  // 7. Miniatura — producto #1 de atención (sin ella el CTR muere)
  checks.push({
    id: 'thumbnail',
    label: 'Miniatura',
    status: input.hasThumbnail ? 'pass' : 'fail',
    detail: input.hasThumbnail
      ? 'Miniatura CTR lista para YouTube.'
      : 'SIN MINIATURA: YouTube pondrá un frame aleatorio y el CTR cae. Regenera antes de publicar.',
  });

  // 8. Cumplimiento (temas prohibidos)
  const forbidden = (input.forbiddenTopics ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean);
  const haystack = `${input.title} ${input.description} ${scenes.map((s) => s.narration).join(' ')}`.toLowerCase();
  const violations = forbidden.filter((t) => haystack.includes(t));
  checks.push({
    id: 'compliance',
    label: 'Temas permitidos',
    status: violations.length === 0 ? 'pass' : 'fail',
    detail:
      violations.length === 0
        ? 'Sin temas prohibidos del canal.'
        : `Contiene temas prohibidos: ${violations.join(', ')}.`,
  });

  // 9. Audio casi silencioso
  const silent = input.nearSilentAudioCount ?? 0;
  checks.push({
    id: 'audio_level',
    label: 'Nivel de audio',
    status: silent === 0 ? 'pass' : silent === 1 ? 'warn' : 'fail',
    detail:
      silent === 0
        ? 'Narración con nivel de audio usable.'
        : `${silent} escena(s) con audio casi silencioso o vacío.`,
  });

  // 10. Stock repetido
  const repeated = input.repeatedStockCount ?? 0;
  checks.push({
    id: 'stock_dedup',
    label: 'Diversidad de stock',
    status: repeated === 0 ? 'pass' : repeated <= 1 ? 'warn' : 'fail',
    detail:
      repeated === 0
        ? 'Sin clips stock repetidos entre escenas.'
        : `${repeated} escena(s) reutilizan el mismo clip stock.`,
  });

  // 11. BGM configurado sin track
  if (input.bgmEnabledWithoutTrack) {
    checks.push({
      id: 'bgm_track',
      label: 'Música de fondo',
      status: 'warn',
      detail: 'BGM activado pero no hay track en resource/bgm ni storage/bgm.',
    });
  } else {
    checks.push({
      id: 'bgm_track',
      label: 'Música de fondo',
      status: 'pass',
      detail: 'Configuración BGM coherente (off o con track disponible).',
    });
  }

  // 12. Word boundaries (sync subtítulos)
  const missingWb = input.missingWordBoundaryCount ?? 0;
  const audioScenes = input.sceneAudioIndexes.length || scenes.length;
  checks.push({
    id: 'word_boundaries',
    label: 'Sincronía palabra-subtítulo',
    status:
      missingWb === 0
        ? 'pass'
        : missingWb <= Math.max(1, Math.floor(audioScenes / 2))
          ? 'warn'
          : 'fail',
    detail:
      missingWb === 0
        ? 'WordBoundaries presentes para sync fino de subtítulos.'
        : `${missingWb} escena(s) sin WordBoundary — subtítulos por frase, menos precisos.`,
  });

  const score = Math.round(
    (checks.reduce((sum, c) => sum + STATUS_WEIGHT[c.status], 0) / checks.length) * 100,
  );
  const passed = checks.every((c) => c.status !== 'fail');
  const threshold = input.minScoreToApprove ?? 80;

  return {
    score,
    passed,
    autoApproved: passed && score >= threshold,
    checks,
    generatedAt: new Date().toISOString(),
  };
}

/** Guía alineada con scoreHook() / scoreIdea() para prompts LLM. */
export function getViralHookGuidelines(minScore = 0): string {
  const target =
    minScore > 0
      ? `Objetivo: cada idea debe poder superar score ${minScore}/100.`
      : 'Maximiza el potencial viral de cada idea.';
  return `${target}
- hook: 20-80 caracteres; pregunta con "?" o afirmación con "!" en las primeras palabras
- Usa al menos una palabra de impacto: secreto, nunca, verdad, imposible, olvidado, paradoja, prohibido, misterio, oculto
- Incluye un número cuando encaje (año, cifra, duración) o un personaje/lugar/empresa concreto
- title: 30-70 caracteres, específico — sujeto + época/lugar + giro (no genérico)
- PROHIBIDO: listas ("5 cosas"), "datos que no sabías", "te sorprenderá" sin especificidad
- PROHIBIDO hooks lentos: "En este vídeo", "Hoy hablaremos", "Bienvenidos"
- angle: debe describir el giro narrativo concreto (mecanismo o revelación), no "es interesante"
- rationale: por qué engancha en una frase (específico al caso)
- trendAlignment: 0.85-1.0 si el tema encaja con las tendencias; si no, sé honesto (0.5-0.7)`;
}
