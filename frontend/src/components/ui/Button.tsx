import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
type Size = 'default' | 'sm';

function btnClass(variant: Variant, size: Size, className?: string) {
  const classes = ['btn', `btn-${variant}`];
  if (size === 'sm') classes.push('btn-sm');
  if (className) classes.push(className);
  return classes.join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'default',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={btnClass(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'default',
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={btnClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
