import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/Button';

export default async function NotFound() {
  const t = await getTranslations('errors');
  const tc = await getTranslations('common');

  return (
    <div className="status-screen">
      <span className="status-screen-icon" aria-hidden="true">🧭</span>
      <span className="status-screen-code">{t('404code')}</span>
      <h1>{t('404title')}</h1>
      <p>{t('404desc')}</p>
      <div className="status-screen-actions">
        <ButtonLink href="/" variant="primary">{t('backHome')}</ButtonLink>
        <ButtonLink href="/channels" variant="secondary">{tc('goToChannels')}</ButtonLink>
      </div>
    </div>
  );
}
