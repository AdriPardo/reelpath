'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

const FILTER_VALUES = ['all', 'pending', 'approved', 'scheduled', 'published', 'rejected'] as const;

export function VideoFilters() {
  const t = useTranslations('videoFilters');
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams?.get('status') ?? 'all';

  function setFilter(status: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (status === 'all') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    const qs = params.toString();
    router.push(qs ? `/videos?${qs}` : '/videos', { scroll: false });
  }

  return (
    <div className="filter-tabs" role="tablist" aria-label={t('aria')}>
      {FILTER_VALUES.map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={current === value}
          className={`filter-tab${current === value ? ' filter-tab-active' : ''}`}
          onClick={() => setFilter(value)}
        >
          {t(value)}
        </button>
      ))}
    </div>
  );
}
