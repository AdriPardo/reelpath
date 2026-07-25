'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

export function PipelineRetryButton({
  pipelineId,
  compact = false,
}: {
  pipelineId: string;
  compact?: boolean;
}) {
  const t = useTranslations('pipelines');
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function retry() {
    setLoading(true);
    try {
      const data = await api<{ message?: string; step?: string }>(`/api/pipelines/${pipelineId}/retry`, {
        method: 'POST',
      });
      toast(data.message ?? (data.step ? t('retryFromStep', { step: data.step }) : t('retry')), 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('retryError'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant={compact ? 'secondary' : 'primary'} size={compact ? 'sm' : undefined} disabled={loading} onClick={retry}>
      {loading ? t('retrying') : compact ? t('retryCompact') : t('retry')}
    </Button>
  );
}
