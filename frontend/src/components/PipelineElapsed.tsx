'use client';

import { usePipelineElapsedLabel } from '@/hooks/usePipelineElapsedLabel';

export function PipelineElapsed({
  createdAt,
  completedAt,
  className,
}: {
  createdAt: string;
  completedAt?: string | null;
  className?: string;
}) {
  const elapsed = usePipelineElapsedLabel(createdAt, completedAt);
  return <span className={className}>{elapsed}</span>;
}
