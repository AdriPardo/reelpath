import { translate, type AppLocale } from '@/lib/i18n';

export const PIPELINE_STEPS = [
  'generate_ideas',
  'select_idea',
  'generate_script',
  'generate_media',
  'render_video',
  'auto_review',
  'await_review',
  'publish',
  'split_shorts',
  'generate_short',
  'publish_youtube_shorts',
  'sync_analytics',
  'optimize_prompts',
] as const;

export interface PipelineStepperOptions {
  reviewRequired?: boolean;
  publishYoutubeShorts?: boolean;
  videoFormat?: 'shorts' | 'long';
  shortsMode?: 'split' | 'dedicated' | 'mixed';
  longShortsFromVideo?: number;
}

function needsVerticalClipSplit(opts: PipelineStepperOptions): boolean {
  return opts.publishYoutubeShorts === true && opts.videoFormat === 'long';
}

function verticalClipSteps(opts: PipelineStepperOptions): readonly string[] {
  if (!needsVerticalClipSplit(opts)) return [];
  if (opts.shortsMode === 'dedicated') return ['generate_short'];
  if (opts.shortsMode === 'mixed') return ['split_shorts', 'generate_short'];
  return ['split_shorts'];
}

/** Pasos visibles según flujo del canal (pre-review vs auto-publish). */
export function getVisiblePipelineSteps(opts: PipelineStepperOptions = {}): readonly string[] {
  const review = opts.reviewRequired !== false;
  const clipSplit = needsVerticalClipSplit(opts);
  const clipSteps = verticalClipSteps(opts);

  const base = [
    'generate_ideas',
    'select_idea',
    'generate_script',
    'generate_media',
    'render_video',
  ];

  if (review && clipSplit) {
    return [...base, ...clipSteps, 'auto_review', 'await_review', 'publish', 'publish_youtube_shorts'];
  }
  if (review) {
    return [...base, 'auto_review', 'await_review', 'publish'];
  }
  if (clipSplit) {
    return [...base, 'publish', ...clipSteps, 'publish_youtube_shorts'];
  }
  return [...base, 'publish'];
}

/** @deprecated Usa getVisiblePipelineSteps() con config del canal. */
export const VISIBLE_PIPELINE_STEPS = getVisiblePipelineSteps({ reviewRequired: true });

const STEP_KEYS: Record<string, string> = {
  generate_ideas: 'pipelines.steps.generate_ideas',
  select_idea: 'pipelines.steps.select_idea',
  generate_script: 'pipelines.steps.generate_script',
  generate_media: 'pipelines.steps.generate_media',
  render_video: 'pipelines.steps.render_video',
  auto_review: 'pipelines.steps.auto_review',
  await_review: 'pipelines.steps.await_review',
  publish: 'pipelines.steps.publish',
  split_shorts: 'pipelines.steps.split_shorts',
  generate_short: 'pipelines.steps.generate_short',
  publish_youtube_shorts: 'pipelines.steps.publish_youtube_shorts',
  sync_analytics: 'pipelines.steps.sync_analytics',
  optimize_prompts: 'pipelines.steps.optimize_prompts',
};

/** Etiqueta contextual según modo de Shorts del canal. */
export function getPipelineStepLabel(
  step: string,
  opts: PipelineStepperOptions = {},
  locale: AppLocale = 'es',
): string {
  if (opts.shortsMode === 'mixed') {
    const parts = opts.longShortsFromVideo ?? 1;
    if (step === 'split_shorts') {
      return parts > 1
        ? translate(locale, 'pipelines.steps.cutShortN', { n: parts })
        : translate(locale, 'pipelines.steps.cutShort');
    }
    if (step === 'generate_short') return translate(locale, 'pipelines.steps.generateTeasers');
  }
  if (opts.shortsMode === 'split' && step === 'split_shorts' && opts.longShortsFromVideo) {
    return translate(locale, 'pipelines.steps.cutShortN', { n: opts.longShortsFromVideo });
  }
  if (opts.shortsMode === 'dedicated' && step === 'generate_short') {
    return translate(locale, 'pipelines.steps.generateTopicTeasers');
  }
  const key = STEP_KEYS[step];
  return key ? translate(locale, key) : step;
}

export const PIPELINE_STEP_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(STEP_KEYS).map(([step, key]) => [step, translate('es', key)]),
);

export const PIPELINE_STEP_ICONS: Record<string, string> = {
  generate_ideas: 'I',
  select_idea: 'S',
  generate_script: 'G',
  generate_media: 'M',
  render_video: 'R',
  auto_review: 'Q',
  await_review: 'V',
  publish: 'Y',
  split_shorts: 'T',
  generate_short: 'D',
  publish_youtube_shorts: 'S',
};
