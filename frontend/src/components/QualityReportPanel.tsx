'use client';

import { useTranslations } from 'next-intl';
import type { VideoQualityReport } from '@/lib/api';

const STATUS_META: Record<
  'pass' | 'warn' | 'fail',
  { icon: string; className: string; labelKey: 'pass' | 'warn' | 'fail' }
> = {
  pass: { icon: '✓', className: 'quality-check-pass', labelKey: 'pass' },
  warn: { icon: '!', className: 'quality-check-warn', labelKey: 'warn' },
  fail: { icon: '✕', className: 'quality-check-fail', labelKey: 'fail' },
};

function scoreClass(score: number): string {
  if (score >= 80) return 'quality-score-good';
  if (score >= 60) return 'quality-score-mid';
  return 'quality-score-low';
}

export function QualityReportPanel({
  report,
  compact = false,
}: {
  report: VideoQualityReport;
  compact?: boolean;
}) {
  const t = useTranslations('videos.quality');
  const tr = useTranslations('review.qualityReport');

  const headline = report.autoApproved
    ? t('approved')
    : report.passed
      ? t('ready')
      : t('warnings');

  return (
    <section className="quality-report" aria-label={tr('title')}>
      <header className="quality-report-header">
        <div className={`quality-score ${scoreClass(report.score)}`}>
          <span className="quality-score-value">{report.score}</span>
          <span className="quality-score-max">/100</span>
        </div>
        <div className="quality-report-headline">
          <strong>{headline}</strong>
          <span className="text-muted text-sm">{tr('quality')}</span>
        </div>
      </header>

      {!compact && (
        <ul className="quality-check-list">
          {report.checks.map((check) => {
            const meta = STATUS_META[check.status];
            const statusLabel =
              meta.labelKey === 'pass' ? 'OK' : tr(meta.labelKey);
            return (
              <li key={check.id} className={`quality-check ${meta.className}`}>
                <span className="quality-check-icon" aria-hidden="true">
                  {meta.icon}
                </span>
                <span className="quality-check-body">
                  <span className="quality-check-label">{check.label}</span>
                  <span className="quality-check-detail text-muted text-sm">{check.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
