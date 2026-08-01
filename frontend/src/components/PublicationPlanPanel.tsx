'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface ShortSlotPlan {
  orderIndex: number;
  scheduledAt: string;
  label: string;
}

interface VideoPublicationPlan {
  videoId: string;
  title?: string;
  scheduledAt: string;
  recommendation: string;
  shorts: ShortSlotPlan[];
  slotFeedback?: { message: string; severity: 'info' | 'warning' } | null;
  isPersisted?: boolean;
}

interface PublicationCalendar {
  channelTimezone: string;
  plannerEnabled: boolean;
  entries: VideoPublicationPlan[];
  nextAvailableSlot: string | null;
  unscheduledCount?: number;
  plannerFeedback?: Array<{ message: string; severity: 'info' | 'warning' }>;
  insightsSource?: 'heuristic' | 'analytics';
  insights?: {
    confident?: boolean;
    bestHours?: number[];
    sampleCount?: number;
    source?: string;
  };
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function buildWeekDays(reference: Date): Date[] {
  const start = startOfLocalDay(reference);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function PlannerSkeleton() {
  return (
    <div className="planner-surface" aria-busy="true" aria-label="Loading">
      <div className="planner-week-grid planner-week-grid--skeleton">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="planner-week-day">
            <Skeleton style={{ width: '3rem', height: '0.75rem', marginBottom: '0.5rem' }} />
            <Skeleton style={{ width: '2.5rem', height: '1rem', marginBottom: '0.75rem' }} />
            <Skeleton style={{ height: '2.5rem', marginBottom: '0.35rem' }} />
            <Skeleton style={{ height: '2.5rem', width: '85%' }} />
          </div>
        ))}
      </div>
      <div className="planner-queue">
        <Skeleton style={{ width: '8rem', height: '1rem', marginBottom: '1rem' }} />
        <Skeleton style={{ height: '4.5rem', marginBottom: '0.5rem' }} />
        <Skeleton style={{ height: '4.5rem' }} />
      </div>
    </div>
  );
}

export function PublicationPlanPanel({
  channelId,
  plannerEnabledFromConfig,
  timezoneFromConfig,
}: {
  channelId: string;
  plannerEnabledFromConfig?: boolean;
  timezoneFromConfig?: string;
}) {
  const t = useTranslations('channels.publicationPlan');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-GB' : 'es-ES';
  const { toast } = useToast();
  const [plan, setPlan] = useState<PublicationCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [draftDates, setDraftDates] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<PublicationCalendar>(`/api/channels/${channelId}/publication-plan`);
      setPlan(data);
      const drafts: Record<string, string> = {};
      for (const entry of data.entries) {
        drafts[entry.videoId] = toDatetimeLocalValue(entry.scheduledAt);
      }
      setDraftDates(drafts);
      setSelectedId((prev) => {
        if (prev && data.entries.some((e) => e.videoId === prev)) return prev;
        return data.entries[0]?.videoId ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [channelId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const weekDays = useMemo(() => buildWeekDays(new Date()), []);
  const todayKey = startOfLocalDay(new Date()).toISOString();

  const weekItems = useMemo(() => {
    const map = new Map<
      string,
      Array<{ kind: 'long' | 'short'; title: string; at: Date; videoId: string }>
    >();
    for (const day of weekDays) {
      map.set(startOfLocalDay(day).toISOString(), []);
    }
    if (!plan) return map;
    for (const entry of plan.entries) {
      const longAt = new Date(entry.scheduledAt);
      const longKey = startOfLocalDay(longAt).toISOString();
      if (map.has(longKey)) {
        map.get(longKey)!.push({
          kind: 'long',
          title: entry.title ?? entry.videoId.slice(0, 8),
          at: longAt,
          videoId: entry.videoId,
        });
      }
      for (const short of entry.shorts) {
        const shortAt = new Date(short.scheduledAt);
        const shortKey = startOfLocalDay(shortAt).toISOString();
        if (map.has(shortKey)) {
          map.get(shortKey)!.push({
            kind: 'short',
            title: short.label,
            at: shortAt,
            videoId: entry.videoId,
          });
        }
      }
    }
    for (const items of map.values()) {
      items.sort((a, b) => a.at.getTime() - b.at.getTime());
    }
    return map;
  }, [plan, weekDays]);

  const selected = plan?.entries.find((e) => e.videoId === selectedId) ?? null;

  async function applySuggestedDates() {
    setApplying(true);
    try {
      const result = await api<{
        updated: number;
        skipped: number;
        plan: PublicationCalendar;
      }>(`/api/channels/${channelId}/publication-plan/apply`, { method: 'POST' });
      setPlan(result.plan);
      const drafts: Record<string, string> = {};
      for (const entry of result.plan.entries) {
        drafts[entry.videoId] = toDatetimeLocalValue(entry.scheduledAt);
      }
      setDraftDates(drafts);
      toast(
        result.updated > 0 ? t('applySuccess', { count: result.updated }) : t('applyNone'),
        result.updated > 0 ? 'success' : 'info',
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : t('applyError'), 'error');
    } finally {
      setApplying(false);
    }
  }

  async function saveSchedule(videoId: string) {
    const value = draftDates[videoId];
    if (!value) return;
    setSavingId(videoId);
    try {
      await api(`/api/videos/${videoId}/schedule`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduledPublishAt: new Date(value).toISOString() }),
      });
      toast(t('rescheduleSuccess'), 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('rescheduleError'), 'error');
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <PlannerSkeleton />;

  if (error) {
    return (
      <div className="planner-empty" role="alert">
        <p className="planner-empty-title">{t('errorTitle')}</p>
        <p className="planner-empty-body">{error}</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  const enabled = plan?.plannerEnabled ?? plannerEnabledFromConfig === true;
  const timezone = plan?.channelTimezone ?? timezoneFromConfig ?? 'Europe/Madrid';

  if (!enabled) {
    return (
      <div className="planner-empty">
        <p className="planner-empty-title">{t('disabledTitle')}</p>
        <p className="planner-empty-body">{t('disabledHintInline')}</p>
        <p className="planner-empty-hint text-muted text-sm">{t('disabledHintAction')}</p>
      </div>
    );
  }

  const canApply = (plan?.unscheduledCount ?? 0) > 0;
  const entries = plan?.entries ?? [];

  return (
    <div className="planner-surface">
      <header className="planner-header">
        <div className="planner-header-main">
          <div className="planner-status-row">
            <span className="planner-status planner-status--on" aria-live="polite">
              {t('statusOn')}
            </span>
            <span className="planner-tz" title={timezone}>
              {t('timezone', { tz: timezone })}
            </span>
            {plan?.insights?.confident && plan.insights.bestHours?.[0] != null && (
              <span className="planner-status planner-status--on" title={t('insightsTitle')}>
                {t('insightsOptimalHour', {
                  hour: String(plan.insights.bestHours[0]).padStart(2, '0'),
                  count: plan.insights.sampleCount ?? 0,
                })}
              </span>
            )}
            {plan?.insightsSource === 'heuristic' && (
              <span className="text-muted text-sm">{t('insightsHeuristic')}</span>
            )}
          </div>
          {plan?.nextAvailableSlot && (
            <p className="planner-next-slot text-muted text-sm">
              {t('nextSlot', {
                date: new Date(plan.nextAvailableSlot).toLocaleString(dateLocale, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </p>
          )}
        </div>
        <div className="planner-header-actions">
          <InfoTooltip content={t('tooltip')} />
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={applying || !canApply || entries.length === 0}
            onClick={() => void applySuggestedDates()}
          >
            {applying ? t('applying') : t('applySuggested')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
            {t('refresh')}
          </Button>
        </div>
      </header>

      {plan?.plannerFeedback && plan.plannerFeedback.length > 0 && (
        <ul className="planner-feedback">
          {plan.plannerFeedback.map((fb, i) => (
            <li
              key={i}
              className={`planner-feedback-item${fb.severity === 'warning' ? ' is-warning' : ''}`}
            >
              {fb.message}
            </li>
          ))}
        </ul>
      )}

      <section className="planner-week-section" aria-label={t('weekViewAria')}>
        <div className="planner-section-label">{t('weekSectionLabel')}</div>
        <div className="planner-week-grid">
          {weekDays.map((day) => {
            const key = startOfLocalDay(day).toISOString();
            const items = weekItems.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={`planner-week-day${isToday ? ' is-today' : ''}${items.length ? ' has-items' : ''}`}
              >
                <div className="planner-week-day-header">
                  <span className="planner-week-weekday">
                    {day.toLocaleDateString(dateLocale, { weekday: 'short' })}
                  </span>
                  <span className="planner-week-date">
                    {day.toLocaleDateString(dateLocale, { day: 'numeric' })}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="planner-week-empty">{t('weekEmpty')}</p>
                ) : (
                  <ul className="planner-week-items">
                    {items.map((item, idx) => (
                      <li key={`${item.kind}-${idx}-${item.at.toISOString()}`}>
                        <button
                          type="button"
                          className={`planner-week-item planner-week-item-${item.kind}${
                            selectedId === item.videoId ? ' is-selected' : ''
                          }`}
                          onClick={() => setSelectedId(item.videoId)}
                        >
                          <span className="planner-week-item-meta">
                            <span className="planner-week-item-kind">
                              {item.kind === 'long' ? t('weekLong') : t('weekShort')}
                            </span>
                            <span className="planner-week-item-time">
                              {item.at.toLocaleTimeString(dateLocale, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </span>
                          <span className="planner-week-item-title">{item.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {entries.length === 0 ? (
        <div className="planner-empty planner-empty--inline">
          <p className="planner-empty-title">{t('emptyTitle')}</p>
          <p className="planner-empty-body">{t('emptyQueue')}</p>
          <p className="planner-empty-hint text-muted text-sm">{t('emptyHint')}</p>
        </div>
      ) : (
        <div className="planner-workspace">
          <section className="planner-queue" aria-label={t('queueAria')}>
            <div className="planner-section-label">{t('queueSectionLabel')}</div>
            <ul className="planner-queue-list">
              {entries.map((entry) => {
                const isActive = entry.videoId === selectedId;
                return (
                  <li key={entry.videoId}>
                    <button
                      type="button"
                      className={`planner-queue-row${isActive ? ' is-selected' : ''}`}
                      onClick={() => setSelectedId(entry.videoId)}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <span className="planner-queue-row-main">
                        <span className="planner-queue-title">
                          {entry.title ?? entry.videoId.slice(0, 8)}
                        </span>
                        <span className="planner-queue-when text-muted text-sm">
                          {new Date(entry.scheduledAt).toLocaleString(dateLocale, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                      <span
                        className={`planner-mark${entry.isPersisted ? ' is-persisted' : ''}`}
                      >
                        {entry.isPersisted ? t('badgePersisted') : t('badgeSuggested')}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {selected && (
            <section className="planner-detail" aria-label={t('detailAria')}>
              <div className="planner-section-label">{t('detailSectionLabel')}</div>
              <h4 className="planner-detail-title">
                {selected.title ?? selected.videoId.slice(0, 8)}
              </h4>
              <p className="planner-detail-rec text-sm">{selected.recommendation}</p>
              {selected.slotFeedback && (
                <p
                  className={`planner-detail-feedback text-sm${
                    selected.slotFeedback.severity === 'warning' ? ' is-warning' : ''
                  }`}
                >
                  {selected.slotFeedback.message}
                </p>
              )}

              <div className="planner-reschedule">
                <label className="modal-field" htmlFor={`schedule-${selected.videoId}`}>
                  <span className="field-label">{t('rescheduleLabel')}</span>
                  <input
                    id={`schedule-${selected.videoId}`}
                    type="datetime-local"
                    className="topic-input"
                    value={
                      draftDates[selected.videoId] ?? toDatetimeLocalValue(selected.scheduledAt)
                    }
                    onChange={(e) =>
                      setDraftDates((prev) => ({
                        ...prev,
                        [selected.videoId]: e.target.value,
                      }))
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={
                    savingId === selected.videoId ||
                    (draftDates[selected.videoId] ?? '') ===
                      toDatetimeLocalValue(selected.scheduledAt)
                  }
                  onClick={() => void saveSchedule(selected.videoId)}
                >
                  {savingId === selected.videoId ? t('rescheduleSaving') : t('rescheduleSave')}
                </Button>
              </div>

              {selected.shorts.length > 0 && (
                <ul className="planner-shorts text-sm text-muted">
                  {selected.shorts.map((s) => (
                    <li key={s.orderIndex}>
                      {s.label} — {new Date(s.scheduledAt).toLocaleString(dateLocale)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
