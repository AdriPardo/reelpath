'use client';

import { useEffect, useState } from 'react';
import { pipelineElapsedLabel } from '@/lib/pipeline-progress';

/** Elapsed label safe for SSR — live pipelines tick only after mount. */
export function usePipelineElapsedLabel(
  createdAt: string,
  completedAt?: string | null,
): string {
  const [elapsed, setElapsed] = useState(() =>
    completedAt ? pipelineElapsedLabel(createdAt, completedAt) : '—',
  );

  useEffect(() => {
    if (completedAt) {
      setElapsed(pipelineElapsedLabel(createdAt, completedAt));
      return;
    }

    const tick = () => setElapsed(pipelineElapsedLabel(createdAt, null));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt, completedAt]);

  return elapsed;
}
