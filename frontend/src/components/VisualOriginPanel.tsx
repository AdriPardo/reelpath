'use client';

import type { VisualOrigin, VisualOriginSummary } from '@autotube/shared';
import { visualOriginLabel } from '@autotube/shared';
import { useLocale, useTranslations } from 'next-intl';

interface VisualOriginBadgeProps {
  origin: VisualOrigin;
  compact?: boolean;
}

export function VisualOriginBadge({ origin, compact }: VisualOriginBadgeProps) {
  return (
    <span className={`visual-origin-badge visual-origin-${origin}${compact ? ' visual-origin-badge-compact' : ''}`}>
      {visualOriginLabel(origin)}
    </span>
  );
}

interface VisualOriginSummaryPanelProps {
  summary: VisualOriginSummary;
  compact?: boolean;
}

export function VisualOriginSummaryPanel({ summary, compact }: VisualOriginSummaryPanelProps) {
  const t = useTranslations('visualOrigin');

  if (compact) {
    return (
      <div className="visual-origin-summary visual-origin-summary-compact">
        {summary.stock > 0 && <VisualOriginBadge origin="stock" compact />}
        {summary.ai > 0 && <VisualOriginBadge origin="ai" compact />}
        {summary.placeholder > 0 && <VisualOriginBadge origin="placeholder" compact />}
      </div>
    );
  }

  return (
    <div className="visual-origin-summary">
      <div className="visual-origin-counts">
        {summary.stock > 0 && (
          <span className="visual-origin-count">
            <VisualOriginBadge origin="stock" /> {summary.stock}
          </span>
        )}
        {summary.ai > 0 && (
          <span className="visual-origin-count">
            <VisualOriginBadge origin="ai" /> {summary.ai}
          </span>
        )}
        {summary.placeholder > 0 && (
          <span className="visual-origin-count">
            <VisualOriginBadge origin="placeholder" /> {summary.placeholder}
          </span>
        )}
      </div>
      {summary.scenes.length > 0 && (
        <ul className="visual-origin-scenes">
          {summary.scenes.map((scene) => (
            <li key={scene.sceneIndex}>
              {t('scene', { n: scene.sceneIndex + 1 })} <VisualOriginBadge origin={scene.origin} compact />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function VisualPlaceholderBanner() {
  const t = useTranslations('visualOrigin');

  return (
    <div className="hint-box visual-placeholder-banner" role="status">
      <strong>{t('devBannerTitle')}</strong> — {t('devBannerBody')}
    </div>
  );
}
