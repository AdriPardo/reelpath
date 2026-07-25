import type { ReactNode } from 'react';

export function Callout({
  type,
  title,
  children,
}: {
  type: 'info' | 'warn' | 'success';
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={`docs-callout docs-callout-${type}`} role={type === 'warn' ? 'alert' : undefined}>
      <div className="docs-callout-top">
        <span className="docs-callout-icon" aria-hidden="true">
          {type === 'info' ? 'i' : type === 'warn' ? '!' : '✓'}
        </span>
        <span className="docs-callout-title">{title ?? (type === 'info' ? 'Nota' : type === 'warn' ? 'Importante' : 'OK')}</span>
      </div>
      <div className="docs-callout-body">{children}</div>
    </div>
  );
}

