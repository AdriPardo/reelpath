'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export function RepublishButton({
  videoId,
  youtubeVideoId,
}: {
  videoId: string;
  youtubeVideoId?: string | null;
}) {
  const t = useTranslations('videos.republish');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const needsRetry = !youtubeVideoId;

  async function republish() {
    setLoading(true);
    try {
      const result = await api<{ message?: string }>(`/api/videos/${videoId}/retry-publish`, {
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
    <div className="actions">
      <button className="btn btn-primary" onClick={republish} disabled={loading}>
        {loading
          ? t('sending')
          : needsRetry
            ? t('retry')
            : t('publish')}
      </button>
    </div>
  );
}
