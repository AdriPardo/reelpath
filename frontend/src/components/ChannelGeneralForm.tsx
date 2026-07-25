'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

export function ChannelGeneralForm({
  channelId,
  initialName,
  initialIsActive,
  niche,
}: {
  channelId: string;
  initialName: string;
  initialIsActive: boolean;
  niche: string;
}) {
  const t = useTranslations('channels');
  const tg = useTranslations('channels.general');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const nameId = useId();
  const activeId = useId();
  const [name, setName] = useState(initialName);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [loading, setLoading] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api(`/api/channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      toast(tg('nameUpdated'), 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : tg('saveError'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(next: boolean) {
    setTogglingActive(true);
    setIsActive(next);
    try {
      await api(`/api/channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: next }),
      });
      toast(next ? t('activatedToast') : tg('deactivated'), 'success');
      router.refresh();
    } catch (err) {
      setIsActive(!next);
      toast(err instanceof Error ? err.message : tg('statusChangeError'), 'error');
    } finally {
      setTogglingActive(false);
    }
  }

  return (
    <form className="channel-settings-form" onSubmit={save} aria-label={tg('formAria')}>
      <label className="modal-field" htmlFor={nameId}>
        <span className="field-label-row">
          <span>{tg('nameLabel')}</span>
          <InfoTooltip content={tg('nameTooltip')} />
        </span>
        <input
          id={nameId}
          type="text"
          className="topic-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
        />
      </label>
      <label className="modal-field channel-active-toggle" htmlFor={activeId}>
        <span className="field-label-row">
          <span>{tg('statusLabel')}</span>
          <InfoTooltip content={tg('statusTooltip')} />
        </span>
        <div className="channel-active-row">
          <input
            id={activeId}
            type="checkbox"
            checked={isActive}
            disabled={togglingActive}
            onChange={(e) => void toggleActive(e.target.checked)}
          />
          <span className="text-sm text-muted">
            {isActive ? t('activeDescription') : tg('inactiveHint')}
          </span>
        </div>
      </label>
      <dl className="settings-dl">
        <dt>{tg('niche')}</dt>
        <dd>{niche}</dd>
      </dl>
      <Button type="submit" variant="secondary" disabled={loading || name === initialName}>
        {loading ? tc('saving') : t('saveName')}
      </Button>
    </form>
  );
}
