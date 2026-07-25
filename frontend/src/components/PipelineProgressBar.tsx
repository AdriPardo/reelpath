import { pipelineProgressPercent, pipelineStepLabel } from '@/lib/pipeline-progress';
import { isPipelineInProgress } from '@/lib/pipeline-status';
import type { PipelineStepperOptions } from '@/lib/pipeline-steps';

interface PipelineProgressBarProps {
  currentStep: string | null;
  status: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  stepperOptions?: PipelineStepperOptions;
}

export function PipelineProgressBar({
  currentStep,
  status,
  showLabel = true,
  size = 'md',
  stepperOptions,
}: PipelineProgressBarProps) {
  const pct = pipelineProgressPercent(currentStep, status, stepperOptions);
  const isFailed = status === 'failed' || status === 'rejected';
  const isActive = isPipelineInProgress(status);

  return (
    <div className={`pipeline-progress pipeline-progress-${size}${isActive ? ' pipeline-progress-active' : ''}`}>
      <div className="pipeline-progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`pipeline-progress-fill${isFailed ? ' pipeline-progress-fill-failed' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="pipeline-progress-meta">
          <span className="pipeline-progress-pct">{pct}%</span>
          <span className="pipeline-progress-step">{pipelineStepLabel(currentStep)}</span>
        </span>
      )}
    </div>
  );
}
