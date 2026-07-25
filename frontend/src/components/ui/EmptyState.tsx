import type { ReactNode } from 'react';

type EmptyVariant = 'default' | 'channels' | 'review' | 'pipeline' | 'error';

function EmptyIcon({ variant }: { variant: EmptyVariant }) {
  if (variant === 'error') {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
    );
  }
  if (variant === 'channels') {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="7" height="7" rx="1.5" />
        <rect x="14" y="4" width="7" height="7" rx="1.5" />
        <rect x="3" y="13" width="7" height="7" rx="1.5" />
        <rect x="14" y="13" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (variant === 'review') {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 12l2 2 4-4" />
        <rect x="3" y="3" width="18" height="18" rx="3" />
      </svg>
    );
  }
  if (variant === 'pipeline') {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

interface EmptyStateProps {
  icon?: string;
  variant?: EmptyVariant;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  icon,
  variant = 'default',
  title,
  description,
  action,
  compact,
}: EmptyStateProps) {
  return (
    <div className={`empty-state${compact ? ' empty-state-compact' : ''}`}>
      <span className="empty-state-icon" aria-hidden="true">
        {icon ?? <EmptyIcon variant={variant} />}
      </span>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
