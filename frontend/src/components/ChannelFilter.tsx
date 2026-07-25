'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { Channel } from '@/lib/api';

interface ChannelFilterProps {
  channels: Pick<Channel, 'id' | 'name'>[];
  basePath: string;
}

export function ChannelFilter({ channels, basePath }: ChannelFilterProps) {
  const t = useTranslations('channels');
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectId = useId();
  const current = searchParams?.get('channel') ?? 'all';

  if (channels.length < 2) return null;

  function setChannel(channelId: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (channelId === 'all') {
      params.delete('channel');
    } else {
      params.set('channel', channelId);
    }
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  }

  return (
    <div className="channel-filter">
      <label htmlFor={selectId} className="channel-filter-label">
        {t('filterLabel')}
      </label>
      <select
        id={selectId}
        className="channel-filter-select"
        value={current}
        onChange={(e) => setChannel(e.target.value)}
      >
        <option value="all">{t('allChannels')}</option>
        {channels.map((ch) => (
          <option key={ch.id} value={ch.id}>
            {ch.name}
          </option>
        ))}
      </select>
    </div>
  );
}
