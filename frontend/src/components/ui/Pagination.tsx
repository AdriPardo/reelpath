'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface PaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}

function buildHref(
  basePath: string,
  page: number,
  searchParams?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== 'page') params.set(key, value);
    }
  }
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({ page, totalPages, basePath, searchParams }: PaginationProps) {
  const tc = useTranslations('common');

  if (totalPages <= 1) return null;

  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;

  return (
    <nav className="pagination" aria-label={tc('paginationAria')}>
      {prev ? (
        <Link href={buildHref(basePath, prev, searchParams)} className="pagination-link">
          {tc('previous')}
        </Link>
      ) : (
        <span className="pagination-link pagination-link--disabled">{tc('previous')}</span>
      )}
      <span className="pagination-info">
        {tc('pageInfo', { page, total: totalPages })}
      </span>
      {next ? (
        <Link href={buildHref(basePath, next, searchParams)} className="pagination-link">
          {tc('next')}
        </Link>
      ) : (
        <span className="pagination-link pagination-link--disabled">{tc('next')}</span>
      )}
    </nav>
  );
}
