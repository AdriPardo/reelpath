'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

export function MarkClipPublishedButton({
  videoId,
  clipId,
  compact = false,
}: {
  videoId: string;
  clipId: string;
  compact?: boolean;
}) {
  const t = useTranslations('clips');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [externalId, setExternalId] = useState('');

  async function markPublished() {
    setLoading(true);
    try {
      const body: { externalId?: string } = {};
      const trimmed = externalId.trim();
      if (trimmed) {
        body.externalId = trimmed.replace(/^https?:\/\/(www\.)?youtube\.com\/shorts\//i, '');
      }
      await api(`/api/videos/${videoId}/clips/${clipId}/mark-published`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast(t('markPublishedSuccess'), 'success');
      setShowForm(false);
      setExternalId('');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('markPublishedError'), 'error');
    } finally {
      setLoading(false);
    }
  }

  if (showForm) {
    return (
      <div className="clip-mark-published-form">
        <label className="modal-field">
          <span className="text-sm">{t('youtubeIdOptional')}</span>
          <input
            type="text"
            className="topic-input"
            placeholder={t('youtubeIdPlaceholder')}
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            disabled={loading}
          />
        </label>
        <div className="clip-actions-row">
          <Button type="button" variant="primary" size="sm" disabled={loading} onClick={markPublished}>
            {loading ? tc('saving') : tc('confirm')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={() => {
              setShowForm(false);
              setExternalId('');
            }}
          >
            {tc('cancel')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant={compact ? 'ghost' : 'secondary'}
      size="sm"
      disabled={loading}
      onClick={() => setShowForm(true)}
    >
      {t('markPublished')}
    </Button>
  );
}
