import {
  getPipelineStepLabel,
  getVisiblePipelineSteps,
  type PipelineStepperOptions,
} from './pipeline-steps';

export function pipelineStepLabel(
  step: string | null | undefined,
  options?: PipelineStepperOptions,
): string {
  if (!step) return '—';
  return getPipelineStepLabel(step, options ?? {});
}

function resolveSteps(options?: PipelineStepperOptions): readonly string[] {
  return getVisiblePipelineSteps(options ?? {});
}

export function pipelineProgressPercent(
  currentStep: string | null | undefined,
  status: string,
  options?: PipelineStepperOptions,
): number {
  const steps = resolveSteps(options);
  if (status === 'completed') return 100;
  if (status === 'cancelled') return 0;
  if (status === 'syncing_analytics' || currentStep === 'sync_analytics') return 95;
  if (currentStep === 'optimize_prompts') return 98;
  if (!currentStep) return status === 'scheduled' ? 5 : 0;

  const idx = steps.indexOf(currentStep);
  if (idx === -1) return 0;

  if (status === 'failed' || status === 'rejected') {
    return Math.round(((idx + 0.5) / steps.length) * 100);
  }

  return Math.round(((idx + 1) / steps.length) * 100);
}

export function pipelineElapsedLabel(createdAt: string, completedAt?: string | null): string {
  const start = new Date(createdAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const sec = Math.max(0, Math.floor((end - start) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min < 60) return `${min}m ${rem}s`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

export type PipelineStepState = 'done' | 'active' | 'pending' | 'failed' | 'skipped';

export function pipelineStepState(
  step: string,
  currentStep: string | null,
  status: string,
  options?: PipelineStepperOptions,
): PipelineStepState {
  const steps = resolveSteps(options);
  if (status === 'failed') {
    const idx = steps.indexOf(step);
    const currentIdx = currentStep ? steps.indexOf(currentStep) : -1;
    if (idx < currentIdx) return 'done';
    if (step === currentStep) return 'failed';
    return 'pending';
  }
  if (status === 'cancelled') return 'pending';
  if (status === 'completed') return 'done';
  if (status === 'pending_review' && step === 'await_review') return 'active';
  if (!currentStep) return 'pending';
  const idx = steps.indexOf(step);
  const currentIdx = steps.indexOf(currentStep);
  if (idx < currentIdx) return 'done';
  if (step === currentStep) return 'active';
  if (status === 'pending_review' && (step === 'split_shorts' || step === 'generate_short')) {
    return 'done';
  }
  return 'pending';
}
