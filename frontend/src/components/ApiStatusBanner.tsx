import { getTranslations } from 'next-intl/server';
import { checkApiHealth, getApiUrl } from '@/lib/api';
import { isDevEnvironment } from '@/lib/user-messages';

export async function ApiStatusBanner() {
  const t = await getTranslations('api');
  const online = await checkApiHealth();

  if (online) return null;

  return (
    <div className="api-offline-banner" role="alert">
      <strong>{t('serviceUnavailableTitle')}</strong>
      <span>{t('serviceUnavailable')}</span>
      {isDevEnvironment() && (
        <details className="api-offline-dev-details">
          <summary>{t('devInfoSummary')}</summary>
          <p>
            {t('devConnectionHint')} <code>{getApiUrl()}</code>. <code>npm run dev</code>
          </p>
        </details>
      )}
    </div>
  );
}
