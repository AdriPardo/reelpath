'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { ChannelConfig } from '@autotube/shared';
import { api } from '@/lib/api';
import { plannerTimezoneOptions } from '@/lib/planner-timezones';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

type PlannerFormConfig = Pick<
  ChannelConfig,
  | 'publishPlannerEnabled'
  | 'timezone'
  | 'maxLongsPerWeek'
  | 'preferredPublishHour'
  | 'preferredPublishDays'
  | 'minDaysBetweenLongs'
  | 'shortPreferredSlots'
  | 'autoGenerateEnabled'
  | 'autoGenerateLeadDays'
>;

const WEEKDAY_KEYS = [
  'daySun',
  'dayMon',
  'dayTue',
  'dayWed',
  'dayThu',
  'dayFri',
  'daySat',
] as const;

function slotsToStrings(slots: Array<{ hour: number; minute: number }> | undefined): string[] {
  const source =
    slots && slots.length > 0
      ? slots
      : [
          { hour: 12, minute: 30 },
          { hour: 19, minute: 0 },
        ];
  return source.map(
    (s) => `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`,
  );
}

function stringsToSlots(values: string[]): Array<{ hour: number; minute: number }> {
  const parsed = values
    .map((raw) => {
      const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
      if (!match) return null;
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
      return { hour, minute };
    })
    .filter((s): s is { hour: number; minute: number } => s !== null);

  const unique = parsed.filter(
    (s, i, arr) => arr.findIndex((x) => x.hour === s.hour && x.minute === s.minute) === i,
  );
  return unique.length > 0 ? unique : [{ hour: 12, minute: 30 }, { hour: 19, minute: 0 }];
}

export function ChannelPlannerSettings({
  channelId,
  initialConfig,
  defaultOpen = false,
}: {
  channelId: string;
  initialConfig: PlannerFormConfig;
  defaultOpen?: boolean;
}) {
  const t = useTranslations('channels.settingsForm');
  const tc = useTranslations('common');
  const tch = useTranslations('channels');
  const router = useRouter();
  const { toast } = useToast();
  const formId = useId();

  const [config, setConfig] = useState<PlannerFormConfig>({
    publishPlannerEnabled: initialConfig.publishPlannerEnabled === true,
    timezone: initialConfig.timezone ?? 'Europe/Madrid',
    maxLongsPerWeek: initialConfig.maxLongsPerWeek ?? 1,
    preferredPublishHour: initialConfig.preferredPublishHour ?? 19,
    preferredPublishDays: initialConfig.preferredPublishDays?.length
      ? [...initialConfig.preferredPublishDays]
      : [5],
    minDaysBetweenLongs:
      initialConfig.minDaysBetweenLongs ?? Math.ceil(7 / (initialConfig.maxLongsPerWeek ?? 1)),
    shortPreferredSlots: initialConfig.shortPreferredSlots,
    autoGenerateEnabled: initialConfig.autoGenerateEnabled === true,
    autoGenerateLeadDays: initialConfig.autoGenerateLeadDays ?? 1,
  });
  const [slotInputs, setSlotInputs] = useState(() =>
    slotsToStrings(initialConfig.shortPreferredSlots),
  );
  const [newSlot, setNewSlot] = useState('15:00');
  const [loading, setLoading] = useState(false);

  const timezones = plannerTimezoneOptions(config.timezone);
  const selectedDays = new Set(config.preferredPublishDays ?? [5]);
  const enabled = config.publishPlannerEnabled === true;

  function toggleDay(day: number) {
    setConfig((c) => {
      const current = new Set(c.preferredPublishDays ?? [5]);
      if (current.has(day)) current.delete(day);
      else current.add(day);
      const next = [...current].sort((a, b) => a - b);
      return { ...c, preferredPublishDays: next.length > 0 ? next : [5] };
    });
  }

  function removeSlot(index: number) {
    setSlotInputs((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function addSlot() {
    const normalized = stringsToSlots([newSlot]);
    if (normalized.length === 0) return;
    const hhmm = `${String(normalized[0].hour).padStart(2, '0')}:${String(normalized[0].minute).padStart(2, '0')}`;
    setSlotInputs((prev) => (prev.includes(hhmm) ? prev : [...prev, hhmm].sort()));
    setNewSlot('15:00');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload: PlannerFormConfig = {
      ...config,
      publishPlannerEnabled: config.publishPlannerEnabled === true,
      timezone: config.timezone?.trim() || 'Europe/Madrid',
      preferredPublishDays: (config.preferredPublishDays ?? [5]).length
        ? config.preferredPublishDays
        : [5],
      shortPreferredSlots: stringsToSlots(slotInputs),
      autoGenerateEnabled: config.autoGenerateEnabled === true && config.publishPlannerEnabled === true,
      autoGenerateLeadDays: Math.min(3, Math.max(0, Number(config.autoGenerateLeadDays ?? 1))),
    };
    try {
      await api(`/api/channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ config: payload }),
      });
      toast(t('savedToast'), 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('errorGeneric'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="planner-config" open={defaultOpen || !enabled}>
      <summary className="planner-config-summary">
        <span className="planner-config-summary-title">{t('plannerLegend')}</span>
        <span className="planner-config-summary-meta text-muted text-sm">
          {enabled ? t('plannerConfigOpenHint') : t('plannerConfigClosedHint')}
        </span>
      </summary>

      <form
        id={formId}
        className="channel-settings-form channel-planner-settings"
        onSubmit={save}
        aria-label={t('plannerFormAria')}
      >
        <div className="planner-config-body">
          <label className="modal-checkbox">
            <input
              type="checkbox"
              checked={enabled}
              onChange={() =>
                setConfig((c) => ({ ...c, publishPlannerEnabled: !c.publishPlannerEnabled }))
              }
            />
            <span className="checkbox-label-row">
              <span>{t('plannerEnabledLabel')}</span>
              <InfoTooltip content={t('plannerEnabledTooltip')} />
            </span>
          </label>

          {enabled && (
            <>
              <label className="modal-checkbox">
                <input
                  type="checkbox"
                  checked={config.autoGenerateEnabled === true}
                  onChange={() =>
                    setConfig((c) => ({ ...c, autoGenerateEnabled: !c.autoGenerateEnabled }))
                  }
                />
                <span className="checkbox-label-row">
                  <span>{t('autoGenerateLabel')}</span>
                  <InfoTooltip content={t('autoGenerateTooltip')} />
                </span>
              </label>
              {config.autoGenerateEnabled === true && (
                <label className="modal-field">
                  <span className="field-label-row">
                    <span>{t('autoGenerateLeadLabel')}</span>
                    <InfoTooltip content={t('autoGenerateLeadTooltip')} />
                  </span>
                  <input
                    type="number"
                    className="topic-input"
                    min={0}
                    max={3}
                    value={config.autoGenerateLeadDays ?? 1}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        autoGenerateLeadDays: Number(e.target.value),
                      }))
                    }
                  />
                  <span className="text-muted text-sm">{t('autoGenerateLeadHint')}</span>
                </label>
              )}
            </>
          )}

          {enabled && (
            <div className="planner-config-grid">
              <label className="modal-field">
                <span className="field-label-row">
                  <span>{t('timezoneLabel')}</span>
                  <InfoTooltip content={t('timezoneTooltip')} />
                </span>
                <select
                  className="topic-input"
                  value={config.timezone ?? 'Europe/Madrid'}
                  onChange={(e) => setConfig((c) => ({ ...c, timezone: e.target.value }))}
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>

              <label className="modal-field">
                <span className="field-label-row">
                  <span>{t('maxLongsLabel')}</span>
                  <InfoTooltip content={t('maxLongsTooltip')} />
                </span>
                <input
                  type="number"
                  className="topic-input"
                  min={1}
                  max={7}
                  value={config.maxLongsPerWeek ?? 1}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, maxLongsPerWeek: Number(e.target.value) }))
                  }
                />
              </label>

              <label className="modal-field">
                <span className="field-label-row">
                  <span>{t('preferredHourLabel')}</span>
                  <InfoTooltip content={t('preferredHourTooltip')} />
                </span>
                <input
                  type="number"
                  className="topic-input"
                  min={0}
                  max={23}
                  value={config.preferredPublishHour ?? 19}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, preferredPublishHour: Number(e.target.value) }))
                  }
                />
              </label>

              <label className="modal-field">
                <span className="field-label-row">
                  <span>{t('minDaysLabel')}</span>
                  <InfoTooltip content={t('minDaysTooltip')} />
                </span>
                <input
                  type="number"
                  className="topic-input"
                  min={1}
                  max={14}
                  value={
                    config.minDaysBetweenLongs ?? Math.ceil(7 / (config.maxLongsPerWeek ?? 1))
                  }
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, minDaysBetweenLongs: Number(e.target.value) }))
                  }
                />
              </label>

              <div className="modal-field planner-config-span">
                <span className="field-label-row">
                  <span>{t('preferredDaysLabel')}</span>
                  <InfoTooltip content={t('preferredDaysTooltip')} />
                </span>
                <div className="planner-day-grid" role="group" aria-label={t('preferredDaysLabel')}>
                  {WEEKDAY_KEYS.map((key, day) => (
                    <label key={key} className="planner-day-chip">
                      <input
                        type="checkbox"
                        checked={selectedDays.has(day)}
                        onChange={() => toggleDay(day)}
                      />
                      <span>{t(key)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-field planner-config-span">
                <span className="field-label-row">
                  <span>{t('shortSlotsLabel')}</span>
                  <InfoTooltip content={t('shortSlotsTooltip')} />
                </span>
                <ul className="planner-slot-list">
                  {slotInputs.map((slot, index) => (
                    <li key={`${slot}-${index}`} className="planner-slot-row">
                      <input
                        type="time"
                        className="topic-input"
                        value={slot}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSlotInputs((prev) =>
                            prev.map((item, i) => (i === index ? value : item)),
                          );
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSlot(index)}
                        disabled={slotInputs.length <= 1}
                        aria-label={t('shortSlotRemove')}
                      >
                        {t('shortSlotRemove')}
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="planner-slot-add">
                  <input
                    type="time"
                    className="topic-input"
                    value={newSlot}
                    onChange={(e) => setNewSlot(e.target.value)}
                    aria-label={t('shortSlotAdd')}
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={addSlot}>
                    {t('shortSlotAdd')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Button type="submit" variant="secondary" disabled={loading}>
            {loading ? tc('saving') : tch('saveSettings')}
          </Button>
        </div>
      </form>
    </details>
  );
}
