'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

export function VideoMaintenanceActions({
  videoId,
  canDeleteLocal = false,
}: {
  videoId: string;
  canDeleteLocal?: boolean;
}) {
  const t = useTranslations('videos.maintenance');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  async function run(action: 'thumbnail' | 'shorts', label: string) {
    setLoading(action);
    try {
      const path =
        action === 'thumbnail' ? 'regenerate-thumbnail' : 'regenerate-shorts';

      const data = await api<{ message?: string }>(
        `/api/videos/${videoId}/${path}`,
        { method: 'POST' },
      );

      toast(data.message ?? label, 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('errorGeneric'), 'error');
    } finally {
      setLoading(null);
    }
  }

  async function deleteLocal() {
    if (!window.confirm(t('confirmDeleteLocal'))) {
      return;
    }
    setLoading('delete');
    try {
      const data = await api<{ message?: string }>(`/api/videos/${videoId}/delete-local-files`, {
        method: 'POST',
      });
      toast(data.message ?? t('filesDeleted'), 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('errorGeneric'), 'error');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="maintenance-actions">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!!loading}
        onClick={() => run('thumbnail', t('thumbnailRegenerated'))}
      >
        {loading === 'thumbnail' ? '…' : t('regenerateThumbnail')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!!loading}
        onClick={() => run('shorts', t('regeneratingShorts'))}
      >
        {loading === 'shorts' ? '…' : t('regenerateShorts')}
      </Button>
      {canDeleteLocal && (
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={!!loading}
          onClick={deleteLocal}
        >
          {loading === 'delete' ? '…' : t('freeStorage')}
        </Button>
      )}
    </div>
  );
}
