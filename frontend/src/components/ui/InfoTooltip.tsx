'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';

export function InfoTooltip({
  content,
  ariaLabel,
  className = '',
}: {
  content: string;
  ariaLabel?: string;
  className?: string;
}) {
  const t = useTranslations('common');
  const tooltipId = useId();

  return (
    <span className={`info-tooltip ${className}`.trim()}>
      <button
        type="button"
        className="info-tooltip-trigger"
        aria-label={ariaLabel ?? t('moreInfo')}
        aria-describedby={tooltipId}
      >
        i
      </button>
      <span id={tooltipId} role="tooltip" className="info-tooltip-bubble">
        {content}
      </span>
    </span>
  );
}
