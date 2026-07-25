import type { ReactNode } from 'react';

type ChipVariant = 'neutral' | 'success' | 'warning';
type ChipSize = 'sm' | 'md';

export function Chip({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className,
  title,
}: {
  children: ReactNode;
  variant?: ChipVariant;
  size?: ChipSize;
  icon?: ReactNode;
  className?: string;
  title?: string;
}) {
  const classes = ['chip', `chip-${variant}`, `chip-${size}`];
  if (icon) classes.push('chip-with-icon');
  if (className) classes.push(className);

  return (
    <span className={classes.join(' ')} title={title}>
      {icon ? (
        <span className="chip-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="chip-label">{children}</span>
    </span>
  );
}
