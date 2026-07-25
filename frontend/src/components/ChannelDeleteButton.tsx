'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

export function DeleteChannelModal({
  channelName,
  loading,
  onClose,
  onConfirm,
}: {
  channelName: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('channels.delete');
  const tc = useTranslations('common');
  const tch = useTranslations('channels');

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-channel-title"
      >
        <h3 id="delete-channel-title">{t('title', { name: channelName })}</h3>
        <p className="modal-subtitle">{t('subtitle')}</p>
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {tc('cancel')}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? tch('deleting') : tc('deleteChannel')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ChannelDeleteButton({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string;
}) {
  const t = useTranslations('channels');
  const td = useTranslations('channels.delete');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function confirmDelete() {
    setLoading(true);
    try {
      await api<{ success: boolean }>(`/api/channels/${channelId}`, { method: 'DELETE' });
      toast(t('card.deleted'), 'success');
      router.push('/channels');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('card.deleteError'), 'error');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
      <section className="channel-danger-zone" aria-label={td('zoneAria')}>
        <h4>{tc('deleteChannel')}</h4>
        <p className="text-muted text-sm">{td('zoneDescription')}</p>
        <Button type="button" variant="danger" onClick={() => setOpen(true)} disabled={loading}>
          {tc('deleteChannel')}
        </Button>
      </section>

      {open && (
        <DeleteChannelModal
          channelName={channelName}
          loading={loading}
          onClose={() => !loading && setOpen(false)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}
