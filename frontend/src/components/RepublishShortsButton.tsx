'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

export function RepublishShortsButton({
  videoId,
  compact = false,
}: {
  videoId: string;
  compact?: boolean;
}) {
  const t = useTranslations('videos.republishShorts');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function republish() {
    setLoading(true);
    try {
      const result = await api<{ message?: string }>(`/api/videos/${videoId}/republish-shorts`, {
        method: 'POST',
      });
      toast(result.message ?? t('queued'), 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('error'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={compact ? 'secondary' : 'primary'}
      size="sm"
      disabled={loading}
      onClick={republish}
    >
      {loading ? t('sending') : t('retry')}
    </Button>
  );
}
