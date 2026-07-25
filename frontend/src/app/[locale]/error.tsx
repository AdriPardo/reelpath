'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ButtonLink } from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const tc = useTranslations('common');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="status-screen">
      <span className="status-screen-icon" aria-hidden="true">⚠️</span>
      <span className="status-screen-code">{t('pageErrorCode')}</span>
      <h1>{t('pageErrorTitle')}</h1>
      <p>{t('pageErrorDesc')}</p>
      <div className="status-screen-actions">
        <Button variant="primary" onClick={() => reset()}>
          {tc('retry')}
        </Button>
        <ButtonLink href="/" variant="secondary">{t('backHome')}</ButtonLink>
      </div>
    </div>
  );
}
