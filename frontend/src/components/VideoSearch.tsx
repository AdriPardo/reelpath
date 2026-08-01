'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export function VideoSearch() {
  const t = useTranslations('videos');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams?.get('q') ?? '');

  useEffect(() => {
    setValue(searchParams?.get('q') ?? '');
  }, [searchParams]);

  function applySearch(q: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    const trimmed = q.trim();
    if (trimmed) params.set('q', trimmed);
    else params.delete('q');
    const qs = params.toString();
    router.push(qs ? `/videos?${qs}` : '/videos');
  }

  return (
    <form
      className="video-search"
      onSubmit={(e) => {
        e.preventDefault();
        applySearch(value);
      }}
    >
      <input
        type="search"
        className="form-input video-search-input"
        placeholder={t('searchPlaceholder')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={t('searchAria')}
      />
      <button type="submit" className="btn btn-secondary btn-sm">
        {tc('search')}
      </button>
      {searchParams?.get('q') && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setValue('');
            applySearch('');
          }}
        >
          {tc('clear')}
        </button>
      )}
    </form>
  );
}
