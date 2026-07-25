'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatPublishDate } from '@/lib/format-publish-date';
import { Button } from '@/components/ui/Button';

export type SchedulePublishChoice =
  | { mode: 'planner' }
  | { mode: 'now' }
  | { mode: 'manual'; at: string };

function minScheduleInputValue(): string {
  const d = new Date(Date.now() + 2 * 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface PublicationPlanPreview {
  channelTimezone: string;
  plannerEnabled: boolean;
  nextAvailableSlot: string | null;
  entries: Array<{ videoId: string; scheduledAt: string }>;
}

export function SchedulePublishModal({
  open,
  channelId,
  videoId,
  publishPlannerEnabled,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  channelId?: string;
  videoId: string;
  publishPlannerEnabled: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (choice: SchedulePublishChoice) => void;
}) {
  const t = useTranslations('review.scheduleModal');
  const tc = useTranslations('common');
  const groupName = useId();
  const manualInputId = useId();

  const [mode, setMode] = useState<'planner' | 'manual' | 'now'>(
    publishPlannerEnabled ? 'planner' : 'now',
  );
  const [manualAt, setManualAt] = useState(minScheduleInputValue);
  const [plannerDate, setPlannerDate] = useState<string | null>(null);
  const [channelTimezone, setChannelTimezone] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setMode(publishPlannerEnabled ? 'planner' : 'now');
    setManualAt(minScheduleInputValue());
    setPlannerDate(null);
    setChannelTimezone(null);
    setPlanError(null);

    if (!channelId || !publishPlannerEnabled) {
      setPlanLoading(false);
      return;
    }

    let cancelled = false;
    setPlanLoading(true);

    void api<PublicationPlanPreview>(`/api/channels/${channelId}/publication-plan`)
      .then((plan) => {
        if (cancelled) return;
        setChannelTimezone(plan.channelTimezone);
        const entry = plan.entries.find((e) => e.videoId === videoId);
        setPlannerDate(entry?.scheduledAt ?? plan.nextAvailableSlot);
      })
      .catch((err) => {
        if (cancelled) return;
        setPlanError(err instanceof Error ? err.message : t('loadPlannerError'));
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, channelId, videoId, publishPlannerEnabled, t]);

  if (!open) return null;

  const confirmLabel =
    mode === 'now'
      ? loading
        ? t('publishing')
        : t('confirmPublish')
      : loading
        ? t('scheduling')
        : t('confirmSchedule');

  const confirmDisabled = loading || (mode === 'manual' && !manualAt);

  function handleConfirm() {
    if (mode === 'manual') {
      onConfirm({ mode: 'manual', at: manualAt });
      return;
    }
    if (mode === 'planner') {
      onConfirm({ mode: 'planner' });
      return;
    }
    onConfirm({ mode: 'now' });
  }

  const tz = channelTimezone ?? undefined;
  const plannerLabel = plannerDate
    ? formatPublishDate(plannerDate, tz)
    : planLoading
      ? t('calculatingDate')
      : t('autoAssign');

  return (
    <div className="modal-overlay" onClick={() => !loading && onClose()} role="presentation">
      <div
        className="modal card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-publish-title"
      >
        <h3 id="schedule-publish-title">{t('title')}</h3>
        <p className="modal-subtitle">
          {publishPlannerEnabled ? t('subtitlePlanner') : t('subtitleManual')}
        </p>

        <div className="modal-body">
          {publishPlannerEnabled && (
            <label className="modal-checkbox">
              <input
                type="radio"
                name={groupName}
                checked={mode === 'planner'}
                onChange={() => setMode('planner')}
                disabled={loading}
              />
              <span>
                <strong>{t('usePlannerDate')}</strong>
                <span className="modal-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                  {planError ? planError : plannerLabel}
                </span>
              </span>
            </label>
          )}

          {!publishPlannerEnabled && (
            <label className="modal-checkbox">
              <input
                type="radio"
                name={groupName}
                checked={mode === 'now'}
                onChange={() => setMode('now')}
                disabled={loading}
              />
              <span>
                <strong>{t('publishNow')}</strong>
                <span className="modal-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                  {t('publishNowDesc')}
                </span>
              </span>
            </label>
          )}

          <label className="modal-checkbox">
            <input
              type="radio"
              name={groupName}
              checked={mode === 'manual'}
              onChange={() => setMode('manual')}
              disabled={loading}
            />
            <span>
              <strong>{t('chooseDate')}</strong>
              <span className="modal-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                {tz ? t('channelTimezone', { tz }) : t('manualDesc')}
              </span>
            </span>
          </label>

          {mode === 'manual' && (
            <label className="modal-field" htmlFor={manualInputId}>
              {t('dateTime')}
              <input
                id={manualInputId}
                type="datetime-local"
                className="topic-input"
                value={manualAt}
                min={minScheduleInputValue()}
                onChange={(e) => setManualAt(e.target.value)}
                disabled={loading}
              />
            </label>
          )}
        </div>

        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {tc('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            data-testid="schedule-confirm"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
