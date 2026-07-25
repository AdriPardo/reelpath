'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DEMO_CHANNEL, LEGAL_URLS, PLATFORM } from '@/lib/site-brand';

export function MarketingHome() {
  const t = useTranslations('landing');
  const tc = useTranslations('common');

  const STEPS = [
    { num: '01', title: t('stepProduction'), desc: t('stepProductionDesc') },
    { num: '02', title: t('stepReview'), desc: t('stepReviewDesc') },
    { num: '03', title: t('stepPublish'), desc: t('stepPublishDesc') },
  ];

  const SOCIAL_PROOF = [
    { value: t('socialTrialValue'), label: t('socialTrial') },
    { value: t('socialFlowValue'), label: t('socialFlow') },
    { value: t('socialReviewValue'), label: t('socialReview') },
  ] as const;

  const FEATURES = [t('feature1'), t('feature2'), t('feature3')];

  const DEMO_FEATURES = [t('demoFeature1'), t('demoFeature2'), t('demoFeature3')];

  const PLANS = [
    {
      id: 'starter',
      name: t('planCreator'),
      priceLabel: t('priceCreator'),
      description: t('planCreatorDesc'),
      bullets: [t('planCreatorBullet1'), t('planCreatorBullet2'), t('planCreatorBullet3')],
      ctaLabel: t('planCreatorCta'),
    },
    {
      id: 'pro',
      name: t('planPro'),
      priceLabel: t('pricePro'),
      badge: t('planProBadge'),
      description: t('planProDesc'),
      bullets: [t('planProBullet1'), t('planProBullet2'), t('planProBullet3')],
      ctaLabel: t('planProCta'),
    },
    {
      id: 'unlimited',
      name: t('planStudio'),
      priceLabel: t('priceStudio'),
      description: t('planStudioDesc'),
      bullets: [t('planStudioBullet1'), t('planStudioBullet2'), t('planStudioBullet3')],
      ctaLabel: t('planStudioCta'),
    },
  ];

  const FAQ = [
    { q: t('faqAiQ'), a: t('faqAiA') },
    { q: t('faqControlQ'), a: t('faqControlA') },
    { q: t('faqEducationalQ'), a: t('faqEducationalA', { channelName: DEMO_CHANNEL.name }) },
    { q: t('faqCopyrightQ'), a: t('faqCopyrightA') },
  ] as const;

  const taglineParts = PLATFORM.tagline.split(' — ');

  return (
    <div className="home">
      <section className="home-hero">
        <p className="home-eyebrow">{t('eyebrow')}</p>
        <h1 className="home-title">
          {PLATFORM.name}
          <span className="home-title-accent"> — {t('taglinePart1')}</span>
        </h1>
        <p className="home-tagline">{t('taglinePart2')}</p>
        <div className="home-actions">
          <Link href="/register" className="btn btn-primary btn-lg">
            {t('createAccount')}
          </Link>
          <Link href="/login" className="btn btn-secondary btn-lg">
            {t('login')}
          </Link>
        </div>
      </section>

      <section className="home-section home-demo-section" aria-labelledby="home-demo">
        <div className="home-section-heading">
          <h2 id="home-demo" className="home-section-title">
            {t('demoTitle', { channelName: DEMO_CHANNEL.name })}
          </h2>
          <p className="home-section-copy">{t('demoCopy')}</p>
        </div>

        <div className="home-demo-layout">
          <div className="home-demo-player card">
            <div className="home-demo-embed home-demo-embed-placeholder">
              <p className="home-demo-placeholder-title">{t('demoVideoSoon')}</p>
              <p className="text-muted">{t('demoVideoSoonDesc')}</p>
              <a
                href={DEMO_CHANNEL.youtubeUrl}
                className="btn btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('viewChannelYoutube', { channelName: DEMO_CHANNEL.name })}
              </a>
            </div>
          </div>

          <article className="card home-case-study home-case-study-prominent">
            <p className="home-eyebrow" style={{ marginBottom: '0.5rem' }}>
              {t('demoChannelEyebrow')}
            </p>
            <h3>{t('demoChannelTagline')}</h3>
            <p>{t('demoChannelDesc')}</p>
            <ul className="home-pricing-list">
              {DEMO_FEATURES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="home-actions" style={{ marginTop: '1rem' }}>
              <a
                href={DEMO_CHANNEL.youtubeUrl}
                className="btn btn-secondary"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('viewChannel')}
              </a>
              <Link href="/register" className="btn btn-primary">
                {t('tryReelpath')}
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="home-section home-social-proof" aria-label={t('socialProof')}>
        <ul className="home-social-proof-grid">
          {SOCIAL_PROOF.map((item) => (
            <li key={item.label} className="card home-social-proof-item">
              <strong className="home-social-proof-value">{item.value}</strong>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-how">
        <h2 id="home-how" className="home-section-title">
          {t('workflow')}
        </h2>
        <ol className="home-steps">
          {STEPS.map((step) => (
            <li key={step.num} className="home-step card">
              <span className="home-step-num" aria-hidden="true">{step.num}</span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section" aria-labelledby="home-features">
        <h2 id="home-features" className="home-section-title">
          {t('features')}
        </h2>
        <ul className="home-feature-grid">
          {FEATURES.map((item) => (
            <li key={item} className="home-feature card">
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-pricing">
        <div className="home-section-heading">
          <h2 id="home-pricing" className="home-section-title">
            {t('pricing')}
          </h2>
          <p className="home-section-copy">{t('pricingCopy')}</p>
        </div>

        <div className="home-pricing-block">
          <div className="home-pricing-label">{t('monthlySubscription')}</div>
          <div className="home-pricing-grid home-pricing-grid-plans">
            {PLANS.map((plan) => (
              <article key={plan.id} className="card home-pricing-card">
                <div className="home-pricing-top">
                  <div>
                    <h3>{plan.name}</h3>
                    <p>{plan.description}</p>
                  </div>
                  {'badge' in plan && plan.badge && (
                    <span className="home-pricing-badge">{plan.badge}</span>
                  )}
                </div>
                <div className="home-pricing-price">{plan.priceLabel}</div>
                <ul className="home-pricing-list">
                  {plan.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link
                  href={plan.id === 'unlimited' ? `mailto:${PLATFORM.contactEmail}` : '/register'}
                  className="btn btn-secondary"
                >
                  {plan.ctaLabel}
                </Link>
              </article>
            ))}
          </div>
        </div>

        <div className="card home-pricing-note">
          <strong>{t('payPerVideo')}</strong> {t('payPerVideoNote')}
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-faq">
        <h2 id="home-faq" className="home-section-title">
          {t('faq')}
        </h2>
        <div className="home-faq-list">
          {FAQ.map((item) => (
            <details key={item.q} className="card home-faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="card home-about">
        <h2>{t('aboutTitle', { appName: PLATFORM.name })}</h2>
        <p>{t('aboutP1', { appName: PLATFORM.name })}</p>
        <p className="home-about-youtube">{t('aboutP2', { appName: PLATFORM.name })}</p>
      </section>

      <footer className="landing-footer">
        <Link href={LEGAL_URLS.terms}>{tc('termsOfService')}</Link>
        <span aria-hidden="true">·</span>
        <Link href={LEGAL_URLS.privacy}>{tc('privacyPolicy')}</Link>
        <span aria-hidden="true">·</span>
        <a href={`mailto:${PLATFORM.contactEmail}`}>{tc('contact')}</a>
      </footer>
    </div>
  );
}
