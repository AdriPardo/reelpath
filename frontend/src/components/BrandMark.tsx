import { PLATFORM } from '@/lib/site-brand';

type BrandMarkProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Wordmark completo o monograma «R». */
  variant?: 'wordmark' | 'monogram';
};

/** Wordmark tipográfico — sin icono decorativo. */
export function BrandMark({ className, size = 'md', variant = 'wordmark' }: BrandMarkProps) {
  if (variant === 'monogram') {
    return (
      <span
        className={`brand-monogram brand-monogram-${size}${className ? ` ${className}` : ''}`}
        aria-hidden="true"
      >
        R
      </span>
    );
  }

  return (
    <span className={`brand-mark brand-mark-${size}${className ? ` ${className}` : ''}`}>
      Reel<span className="brand-mark-accent">path</span>
    </span>
  );
}

/** @deprecated Usar BrandMark — alias temporal por compatibilidad interna. */
export const AutoTubeIcon = BrandMark;
