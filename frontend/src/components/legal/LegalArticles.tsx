import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LegalHeader } from '@/components/LegalHeader';
import { LEGAL_URLS, PLATFORM } from '@/lib/site-brand';
import { LegalSectionBody, PRIVACY_SECTIONS, TERMS_SECTIONS } from '@/components/legal/LegalSectionBody';

export async function PrivacyPolicyArticle({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });
  const email = PLATFORM.contactEmail;

  return (
    <>
      <LegalHeader />
      <article className="legal-page">
        <h1>{t('h1')}</h1>
        <p className="legal-meta">
          {t('lastUpdated')} <strong>{PLATFORM.name}</strong>
        </p>

        <section>
          <h2>{t('s1Title')}</h2>
          <p>{t('s1P1')}</p>
          <ul>
            <li>{t('s1Li1')}</li>
            <li>
              {t('s1ContactLabel')}{' '}
              <a href={`mailto:${email}`}>{email}</a>
            </li>
            <li>{t('s1Li3')}</li>
          </ul>
        </section>

        <LegalSectionBody sections={PRIVACY_SECTIONS.slice(1, 4)} t={t} />

        <section>
          <h2>{t('s5Title')}</h2>
          <p>
            {t('s5P1')}{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('s5Link')}
            </a>
            .
          </p>
          <ul>
            <li>{t('s5Li1')}</li>
            <li>{t('s5Li2')}</li>
            <li>{t('s5Li3')}</li>
          </ul>
        </section>

        <LegalSectionBody sections={PRIVACY_SECTIONS.slice(5, 8)} t={t} />

        <section>
          <h2>{t('s9Title')}</h2>
          <p>
            {t('s9P1', { email })}{' '}
            <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">
              {t('s9Link')}
            </a>
            .
          </p>
        </section>

        <LegalSectionBody sections={PRIVACY_SECTIONS.slice(9, 12)} t={t} />

        <section>
          <h2>{t('s13Title')}</h2>
          <p>
            <strong>{t('s13P1')}</strong>
            <br />
            {t('s13Email', { email })}
          </p>
        </section>

        <p className="legal-footer">
          <Link href={LEGAL_URLS.terms}>{t('footerTerms')}</Link>
          {' · '}
          <Link href="/">{t('footerHome')}</Link>
        </p>
      </article>
    </>
  );
}

export async function TermsOfServiceArticle({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  const email = PLATFORM.contactEmail;

  return (
    <>
      <LegalHeader />
      <article className="legal-page">
        <h1>{t('h1')}</h1>
        <p className="legal-meta">
          {t('lastUpdated')} <strong>{PLATFORM.name}</strong>
        </p>

        <section>
          <h2>{t('s1Title')}</h2>
          <p>
            {t('s1BeforeLink')}{' '}
            <Link href={LEGAL_URLS.privacy}>{t('privacyLink')}</Link>
            {t('s1AfterLink')}
          </p>
        </section>

        <section>
          <h2>{t('s2Title')}</h2>
          <p>{t('s2P1')}</p>
          <ul>
            <li>{t('s2Li1')}</li>
            <li>{t('s2Li2', { email })}</li>
            <li>{t('s2Li3')}</li>
          </ul>
        </section>

        <LegalSectionBody sections={TERMS_SECTIONS.slice(2, 7)} t={t} />

        <section>
          <h2>{t('s8Title')}</h2>
          <p>
            {t('s8P1')}{' '}
            <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">
              {t('s8YoutubeTerms')}
            </a>{' '}
            {t('s8And')}{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              {t('s8GooglePrivacy')}
            </a>
            .
          </p>
          <ul>
            <li>{t('s8Li1')}</li>
            <li>{t('s8Li2')}</li>
          </ul>
        </section>

        <LegalSectionBody sections={TERMS_SECTIONS.slice(8, 13)} t={t} />

        <section>
          <h2>{t('s14Title')}</h2>
          <p>
            {t('s14P1')}
            <br />
            <a href={`mailto:${email}`}>{email}</a>
          </p>
        </section>

        <p className="legal-footer">
          <Link href={LEGAL_URLS.privacy}>{t('footerPrivacy')}</Link>
          {' · '}
          <Link href="/">{t('footerHome')}</Link>
        </p>
      </article>
    </>
  );
}
