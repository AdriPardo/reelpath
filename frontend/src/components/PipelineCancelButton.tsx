'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

function CancelPipelineModal({
  title,
  loading,
  onClose,
  onConfirm,
}: {
  title: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('pipelines');
  const tr = useTranslations('review');

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-pipeline-title"
      >
        <h3 id="cancel-pipeline-title">{t('cancelTitle')}</h3>
        <p className="modal-subtitle">{t('cancelSubtitle', { title })}</p>
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {tr('goBack')}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? t('cancelling') : t('cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PipelineCancelButton({
  pipelineId,
  pipelineTitle,
  onCancelled,
  compact = false,
}: {
  pipelineId: string;
  pipelineTitle: string;
  onCancelled?: () => void;
  compact?: boolean;
}) {
  const t = useTranslations('pipelines');
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function confirmCancel() {
    setLoading(true);
    try {
      const data = await api<{ message?: string }>(`/api/pipelines/${pipelineId}/cancel`, {
        method: 'POST',
      });
      toast(data.message ?? t('cancelled'), 'success');
      setOpen(false);
      onCancelled?.();
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('cancelError'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={compact ? 'ghost' : 'danger'}
        disabled={loading}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {loading ? t('cancelling') : t('cancelCompact')}
      </Button>

      {open && (
        <CancelPipelineModal
          title={pipelineTitle}
          loading={loading}
          onClose={() => !loading && setOpen(false)}
          onConfirm={confirmCancel}
        />
      )}
    </>
  );
}
