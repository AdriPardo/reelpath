'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface ShortSlotPlan {
  orderIndex: number;
  scheduledAt: string;
  label: string;
}

interface PublicationCalendar {
  channelTimezone: string;
  plannerEnabled: boolean;
  entries: VideoPublicationPlan[];
  nextAvailableSlot: string | null;
  plannerFeedback?: Array<{ message: string; severity: 'info' | 'warning' }>;
}

interface VideoPublicationPlan {
  videoId: string;
  title?: string;
  scheduledAt: string;
  recommendation: string;
  shorts: ShortSlotPlan[];
  slotFeedback?: { message: string; severity: 'info' | 'warning' } | null;
}

export function PublicationPlanPanel({ channelId }: { channelId: string }) {
  const t = useTranslations('channels.publicationPlan');
  const tc = useTranslations('common');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-GB' : 'es-ES';
  const [plan, setPlan] = useState<PublicationCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<PublicationCalendar>(`/api/channels/${channelId}/publication-plan`);
      setPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [channelId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-muted">{t('loading')}</p>;
  }

  if (error) {
    return (
      <p className="text-muted" role="alert">
        {error}
      </p>
    );
  }

  if (!plan?.plannerEnabled) {
    return (
      <p className="text-muted">
        {t('disabledHintBefore')}{' '}
        <strong>{tc('contentTab')}</strong>{' '}
        {t('disabledHintAfter')}
      </p>
    );
  }

  return (
    <div className="publication-plan-panel">
      <div className="section-title-row" style={{ marginBottom: '1rem' }}>
        <p className="text-muted text-sm" style={{ margin: 0 }}>
          {t('timezone', { tz: plan.channelTimezone })}
          {plan.nextAvailableSlot && (
            <>
              {' '}
              — {t('nextSlot', { date: new Date(plan.nextAvailableSlot).toLocaleString(dateLocale) })}
            </>
          )}
        </p>
        <InfoTooltip content={t('tooltip')} />
      </div>

      {plan.plannerFeedback && plan.plannerFeedback.length > 0 && (
        <ul className="hint-box" style={{ marginBottom: '1rem' }}>
          {plan.plannerFeedback.map((fb, i) => (
            <li key={i} className="text-sm">
              {fb.message}
            </li>
          ))}
        </ul>
      )}

      {plan.entries.length === 0 ? (
        <p className="text-muted">{t('emptyQueue')}</p>
      ) : (
        <ul className="publication-plan-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {plan.entries.map((entry) => (
            <li
              key={entry.videoId}
              className="card"
              style={{ marginBottom: '0.75rem', padding: '1rem' }}
            >
              <strong>{entry.title ?? entry.videoId.slice(0, 8)}</strong>
              <p className="text-sm">
                {new Date(entry.scheduledAt).toLocaleString(dateLocale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-sm">{entry.recommendation}</p>
              {entry.slotFeedback && (
                <p
                  className="text-sm"
                  style={{
                    color:
                      entry.slotFeedback.severity === 'warning'
                        ? 'var(--warning, #d97706)'
                        : undefined,
                  }}
                >
                  {entry.slotFeedback.message}
                </p>
              )}
              {entry.shorts.length > 0 && (
                <ul className="text-sm text-muted" style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
                  {entry.shorts.map((s) => (
                    <li key={s.orderIndex}>
                      {s.label} — {new Date(s.scheduledAt).toLocaleString(dateLocale)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>
        {t('refresh')}
      </button>
    </div>
  );
}
