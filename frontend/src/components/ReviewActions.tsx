'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import {
  SchedulePublishModal,
  type SchedulePublishChoice,
} from '@/components/SchedulePublishModal';

function RejectVideoModal({
  loading,
  onClose,
  onConfirm,
}: {
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('review');
  const tc = useTranslations('common');

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-video-title"
      >
        <h3 id="reject-video-title">{t('rejectTitle')}</h3>
        <p className="modal-subtitle">{t('rejectSubtitle')}</p>
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {t('goBack')}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? t('deleting') : t('rejectDelete')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReviewActions({
  videoId,
  channelId,
  publishPlannerEnabled: publishPlannerEnabledProp,
  layout = 'inline',
}: {
  videoId: string;
  channelId?: string;
  publishPlannerEnabled?: boolean;
  layout?: 'inline' | 'stacked';
}) {
  const locale = useLocale();
  const t = useTranslations('review');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<'approved' | 'scheduled' | 'rejected' | null>(null);
  const [publishPlannerEnabled, setPublishPlannerEnabled] = useState(
    publishPlannerEnabledProp ?? false,
  );
  const [rejectOpen, setRejectOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  useEffect(() => {
    if (publishPlannerEnabledProp !== undefined) {
      setPublishPlannerEnabled(publishPlannerEnabledProp);
      return;
    }
    if (!channelId) return;

    let cancelled = false;
    void api<{ config?: { publishPlannerEnabled?: boolean } }>(`/api/channels/${channelId}`)
      .then((channel) => {
        if (!cancelled) {
          setPublishPlannerEnabled(channel.config?.publishPlannerEnabled === true);
        }
      })
      .catch(() => {
        // silencioso
      });

    return () => {
      cancelled = true;
    };
  }, [channelId, publishPlannerEnabledProp]);

  const approveLabel = publishPlannerEnabled ? t('approveSchedule') : t('publishNow');
  const dateLocale = locale === 'en' ? 'en-GB' : 'es-ES';

  async function act(action: 'approve' | 'reject', scheduledPublishAt?: string): Promise<boolean> {
    setLoading(true);

    try {
      if (action === 'approve') {
        const body: { scheduledPublishAt?: string } = {};
        if (scheduledPublishAt) {
          body.scheduledPublishAt = new Date(scheduledPublishAt).toISOString();
        }

        const result = await api<{ reviewStatus: string; scheduledPublishAt?: string | null; message?: string }>(
          `/api/videos/${videoId}/approve`,
          { method: 'POST', body: JSON.stringify(body) },
        );

        if (result.reviewStatus === 'scheduled' && result.scheduledPublishAt) {
          const when = new Date(result.scheduledPublishAt).toLocaleString(dateLocale);
          toast(t('scheduledToast', { date: when }), 'success');
          setDone('scheduled');
        } else {
          toast(
            publishPlannerEnabled && !scheduledPublishAt
              ? t('approvedPlannerToast')
              : scheduledPublishAt
                ? t('scheduledToast', {
                    date: new Date(scheduledPublishAt).toLocaleString(dateLocale),
                  })
                : t('approvedNowToast'),
            publishPlannerEnabled && !scheduledPublishAt ? 'success' : scheduledPublishAt ? 'success' : 'celebrate',
          );
          setDone(scheduledPublishAt ? 'scheduled' : 'approved');
        }
      } else {
        await api(`/api/videos/${videoId}/reject`, { method: 'POST' });
        toast(t('deletedToast'), 'info');
        router.push('/review');
      }

      router.refresh();
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : t('toast.error'), 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleScheduleConfirm(choice: SchedulePublishChoice) {
    const ok =
      choice.mode === 'manual' ? await act('approve', choice.at) : await act('approve');
    if (ok) setScheduleOpen(false);
  }

  if (done) {
    if (done === 'rejected') {
      return <Chip variant="warning">{t('rejected')}</Chip>;
    }

    const isScheduled = done === 'scheduled';
    return (
      <div className="review-celebrate" role="status">
        <span className="review-celebrate-icon" aria-hidden="true">
          {isScheduled ? '🗓️' : '🎉'}
        </span>
        <span className="review-celebrate-title">
          {isScheduled ? t('scheduledCelebration') : t('approvedCelebration')}
        </span>
        <p className="review-celebrate-desc">
          {isScheduled
            ? t('scheduledDesc')
            : publishPlannerEnabled
              ? t('approvedPlannerDesc')
              : t('approvedNowDesc')}
        </p>
      </div>
    );
  }

  const stacked = layout === 'stacked';

  return (
    <div className={`actions review-actions${stacked ? ' review-actions-stacked' : ''}`}>
      <div className="review-actions-primary">
        <button
          className={`btn btn-primary${stacked ? ' btn-block btn-lg' : ''}`}
          onClick={() => setScheduleOpen(true)}
          disabled={loading}
          data-testid="review-approve-open"
        >
          {approveLabel}
        </button>
      </div>

      <button
        className={`btn btn-danger${stacked ? ' btn-ghost review-actions-reject' : ''}`}
        onClick={() => setRejectOpen(true)}
        disabled={loading}
        data-testid="review-reject-open"
      >
        {t('rejectDelete')}
      </button>

      {scheduleOpen && (
        <SchedulePublishModal
          open={scheduleOpen}
          channelId={channelId}
          videoId={videoId}
          publishPlannerEnabled={publishPlannerEnabled}
          loading={loading}
          onClose={() => !loading && setScheduleOpen(false)}
          onConfirm={(choice) => {
            void handleScheduleConfirm(choice);
          }}
        />
      )}

      {rejectOpen && (
        <RejectVideoModal
          loading={loading}
          onClose={() => !loading && setRejectOpen(false)}
          onConfirm={() => {
            void act('reject').finally(() => setRejectOpen(false));
          }}
        />
      )}
    </div>
  );
}
