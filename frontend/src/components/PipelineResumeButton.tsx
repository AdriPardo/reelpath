'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

export function PipelineResumeButton({
  pipelineId,
  force = false,
}: {
  pipelineId: string;
  force?: boolean;
}) {
  const t = useTranslations('pipelines');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function resume() {
    setLoading(true);
    try {
      const data = await api<{ message?: string; step?: string }>(
        `/api/pipelines/${pipelineId}/resume${force ? '?force=true' : ''}`,
        { method: 'POST' },
      );
      toast(data.message ?? (data.step ? t('resumeFromStep', { step: data.step }) : t('resume')), 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('resumeError'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="primary" disabled={loading} onClick={resume}>
      {loading ? t('resuming') : t('resume')}
    </Button>
  );
}
