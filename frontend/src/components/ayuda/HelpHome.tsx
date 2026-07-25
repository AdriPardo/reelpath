import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PLATFORM } from '@/lib/site-brand';
import { getHelpHome } from '@/lib/help/help-content';
import { HelpSearch } from './HelpSearch';
import { HelpShell } from './HelpShell';

export async function HelpHome() {
  const locale = (await getLocale()) as 'es' | 'en';
  const t = await getTranslations({ locale, namespace: 'help' });
  const tn = await getTranslations({ locale, namespace: 'nav' });
  const tc = await getTranslations({ locale, namespace: 'common' });
  const home = getHelpHome(locale);

  return (
    <HelpShell
      breadcrumb={[{ href: '/ayuda', label: tn('help') }]}
      currentNav={{ type: 'home' }}
      rightPane={null}
    >
      <div className="help-home">
        <section className="help-hero card">
          <div className="help-hero-top">
            <div>
              <h1>{t('homeTitle')}</h1>
              <p className="help-hero-subtitle">
                {t('heroSubtitle', { appName: PLATFORM.name })}
              </p>
            </div>
            <HelpSearch />
          </div>

          <div className="help-quick-actions" aria-label={t('quickActions')}>
            {home.quickActions.map((a) => (
              <Link key={a.href} href={a.href} className="help-quick-action">
                <span className="help-quick-action-title">{a.title}</span>
                <span className="help-quick-action-desc">{a.description}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="help-section">
          <header className="help-section-header">
            <h2>{t('categories')}</h2>
          </header>

          <div className="help-categories-grid">
            {home.categories
              .filter((c) => c.articleCount > 0)
              .map((cat) => (
                <Link key={cat.slug} href={cat.href} className="help-category card">
                  <div className="help-category-top">
                    <span className="help-category-icon" aria-hidden="true">
                      {cat.icon}
                    </span>
                    <span className="help-category-title">{cat.title}</span>
                  </div>
                  <p className="help-category-desc">{cat.description}</p>
                  <div className="help-category-meta">
                    <span className="help-category-count">
                      {t('articlesCount', { count: cat.articleCount })}
                    </span>
                    <span className="help-category-cta">{t('viewCta')}</span>
                  </div>
                </Link>
              ))}
          </div>
        </section>

        <section className="help-section">
          <header className="help-section-header">
            <h2>{t('featuredArticles')}</h2>
          </header>

          <div className="help-featured-grid">
            {home.featured.map((a) => (
              <Link key={a.href} href={a.href} className="help-featured card">
                <div className="help-featured-title">{a.title}</div>
                <div className="help-featured-desc">{a.description}</div>
                <div className="help-featured-meta">
                  <span className="help-featured-pill">{a.categoryTitle}</span>
                  <span className="help-featured-read">{t('readCta')}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <footer className="help-footer card">
          <div className="help-footer-left">
            <p className="help-footer-title">{t('missingSomething')}</p>
            <p className="help-footer-subtitle">{t('footerSubtitle')}</p>
          </div>
          <div className="help-footer-right">
            <a className="help-footer-button" href={`mailto:${PLATFORM.contactEmail}`}>
              {t('contactSupport')}
            </a>
            <Link className="help-footer-link" href="/">
              {t('backDashboard')}
            </Link>
          </div>
        </footer>
      </div>
    </HelpShell>
  );
}
