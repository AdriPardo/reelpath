'use client';

import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { fetchApiMockMode, triggerPipeline } from '@/lib/trigger-pipeline';
import { SERVICE_UNAVAILABLE } from '@/lib/user-messages';
import { useToast } from '@/components/ui/Toast';

function minScheduleInputValue(): string {
  const d = new Date(Date.now() + 2 * 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TriggerPipelineButton({
  channelId,
  embedded = false,
}: {
  channelId: string;
  embedded?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('channels.studio');
  const tc = useTranslations('channels.card');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const topicId = useId();
  const scheduleId = useId();
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');

  async function trigger() {
    setLoading(true);

    try {
      const mockMode = await fetchApiMockMode();
      if (mockMode === false) {
        toast(tc('openaiCost'), 'info');
      }

      const trimmed = topic.trim();
      const body: {
        channelId: string;
        topic?: string;
        scheduledPublishAt?: string;
      } = { channelId };

      if (trimmed) body.topic = trimmed;
      if (scheduleEnabled && scheduleAt) {
        body.scheduledPublishAt = new Date(scheduleAt).toISOString();
      }

      await triggerPipeline(body);

      const dateLocale = locale === 'en' ? 'en-GB' : 'es-ES';
      const scheduleNote =
        scheduleEnabled && scheduleAt
          ? tCommon('youtubeScheduled', {
              date: new Date(scheduleAt).toLocaleString(dateLocale),
            })
          : '';

      toast(
        trimmed
          ? t('startedWithTopic', { topic: trimmed, schedule: scheduleNote })
          : t('started', { schedule: scheduleNote }),
        'success',
      );
      setTopic('');
      setScheduleEnabled(false);
      setScheduleAt('');
    } catch (err) {
      const message = err instanceof Error && err.message !== 'offline'
        ? err.message
        : SERVICE_UNAVAILABLE;
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <div className="studio-form">
      {!embedded && (
        <header className="studio-header">
          <h3 id="studio-heading" className="studio-title">
            {t('newGeneration')}
          </h3>
          <p className="studio-desc">{t('description')}</p>
        </header>
      )}

      <div className="studio-field">
        <label htmlFor={topicId} className="studio-field-label">
          {t('topicLabel')}
        </label>
        <input
          id={topicId}
          type="text"
          className="studio-topic-input form-input"
          placeholder={t('topicPlaceholder')}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={200}
          disabled={loading}
        />
        <p className="studio-field-hint">{t('topicHint')}</p>
      </div>

      <details
        className="studio-advanced"
        open={scheduleEnabled}
        onToggle={(e) => {
          const open = (e.target as HTMLDetailsElement).open;
          setScheduleEnabled(open);
          if (open && !scheduleAt) {
            setScheduleAt(minScheduleInputValue());
          }
        }}
      >
        <summary className="studio-advanced-summary">{t('scheduleSummary')}</summary>
        <div className="studio-advanced-body">
          <label htmlFor={scheduleId} className="studio-field-label">
            {t('dateTime')}
          </label>
          <input
            id={scheduleId}
            type="datetime-local"
            className="studio-schedule-input form-input"
            value={scheduleAt}
            min={minScheduleInputValue()}
            onChange={(e) => setScheduleAt(e.target.value)}
            disabled={loading}
          />
          <p className="studio-field-hint">{t('scheduleHint')}</p>
        </div>
      </details>

      <button
        type="button"
        className="btn btn-primary studio-cta"
        onClick={trigger}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="studio-cta-spinner" aria-hidden="true" />
            {t('startingProduction')}
          </>
        ) : (
          t('startGeneration')
        )}
      </button>
    </div>
  );

  if (embedded) return form;

  return (
    <section className="studio-panel" aria-labelledby="studio-heading">
      {form}
    </section>
  );
}
