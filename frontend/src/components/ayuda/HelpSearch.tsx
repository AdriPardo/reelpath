'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type SearchHit = {
  href: string;
  title: string;
  snippet: string;
  categoryTitle: string;
};

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function HelpSearch() {
  const t = useTranslations('help');
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 120);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pointerInsideRef = useRef(false);

  const trimmed = debounced.trim();
  const canSearch = trimmed.length >= 2;

  useEffect(() => {
    if (!canSearch) {
      setHits([]);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    fetch(
      `/api/ayuda/search?q=${encodeURIComponent(trimmed)}&locale=${encodeURIComponent(locale)}`,
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('search_failed'))))
      .then((data: { hits: SearchHit[] }) => {
        setHits(Array.isArray(data.hits) ? data.hits : []);
        setActiveIndex(0);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setHits([]);
      })
      .finally(() => setLoading(false));
  }, [trimmed, canSearch, locale]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const emptyState = useMemo(() => {
    if (!query.trim()) return t('searchHint');
    if (!canSearch) return t('searchMinChars');
    if (loading) return t('searching');
    if (hits.length === 0) return t('noResultsFor', { query: trimmed });
    return '';
  }, [query, canSearch, loading, hits.length, trimmed, t]);

  function navigateTo(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  return (
    <div className="help-search" ref={rootRef}>
      <label className="help-search-label">
        <span className="sr-only">{t('searchAria')}</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              if (!pointerInsideRef.current) setOpen(false);
            }, 0);
          }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, Math.max(0, hits.length - 1)));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === 'Escape') {
              setOpen(false);
            }
            if (e.key === 'Enter' && hits[activeIndex]) {
              e.preventDefault();
              navigateTo(hits[activeIndex].href);
            }
          }}
          type="search"
          placeholder={t('searchPlaceholder')}
          autoComplete="off"
        />
      </label>

      {open && (query.trim().length > 0 || hits.length > 0) && (
        <div
          className="help-search-popover card"
          role="dialog"
          aria-label={t('searchResults')}
          onMouseEnter={() => {
            pointerInsideRef.current = true;
          }}
          onMouseLeave={() => {
            pointerInsideRef.current = false;
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {emptyState ? (
            <div className="help-search-empty">{emptyState}</div>
          ) : (
            <ul className="help-search-results" role="listbox" aria-label={t('resultsLabel')}>
              {hits.map((hit, i) => (
                <li key={hit.href} role="option" aria-selected={i === activeIndex}>
                  <Link
                    className={`help-search-hit${i === activeIndex ? ' help-search-hit-active' : ''}`}
                    href={hit.href}
                    onClick={() => {
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <div className="help-search-hit-title">{hit.title}</div>
                    <div className="help-search-hit-snippet">{hit.snippet}</div>
                    <div className="help-search-hit-meta">{hit.categoryTitle}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
