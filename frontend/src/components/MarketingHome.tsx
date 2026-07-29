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

  const PIPELINE_STEPS = [
    t('proofStepScript'),
    t('proofStepVoice'),
    t('proofStepEdit'),
    t('proofStepReview'),
    t('proofStepPublish'),
  ];

  const DEMO_FEATURES = [t('demoFeature1'), t('demoFeature2'), t('demoFeature3')];

  const PLANS = [
    {
      id: 'starter',
      name: t('planCreator'),
      priceLabel: t('priceCreator'),
      description: t('planCreatorDesc'),
      bullets: [t('planCreatorBullet1'), t('planCreatorBullet2'), t('planCreatorBullet3')],
      ctaLabel: t('planCreatorCta'),
      featured: false,
    },
    {
      id: 'pro',
      name: t('planPro'),
      priceLabel: t('pricePro'),
      badge: t('planProBadge'),
      description: t('planProDesc'),
      bullets: [t('planProBullet1'), t('planProBullet2'), t('planProBullet3')],
      ctaLabel: t('planProCta'),
      featured: true,
    },
    {
      id: 'unlimited',
      name: t('planStudio'),
      priceLabel: t('priceStudio'),
      description: t('planStudioDesc'),
      bullets: [t('planStudioBullet1'), t('planStudioBullet2'), t('planStudioBullet3')],
      ctaLabel: t('planStudioCta'),
      featured: false,
    },
  ];

  const FAQ = [
    { q: t('faqAiQ'), a: t('faqAiA') },
    { q: t('faqControlQ'), a: t('faqControlA') },
    { q: t('faqEducationalQ'), a: t('faqEducationalA', { channelName: DEMO_CHANNEL.name }) },
    { q: t('faqCopyrightQ'), a: t('faqCopyrightA') },
  ] as const;

  const demoVideoId = DEMO_CHANNEL.demoYoutubeVideoId.trim();

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero-glow" aria-hidden="true" />
        <h1 className="home-title">
          {PLATFORM.name}
          <span className="home-title-accent"> — {t('heroOutcome')}</span>
        </h1>
        <p className="home-tagline">{t('heroSupport')}</p>
        <div className="home-actions">
          <Link href="/register" className="btn btn-primary btn-lg">
            {t('startTrial')}
          </Link>
          <Link href="/login" className="home-login-link">
            {t('login')}
          </Link>
        </div>
        <p className="home-trust-line">
          <span>{t('trustTrial')}</span>
          <span aria-hidden="true">·</span>
          <a href={DEMO_CHANNEL.youtubeUrl} target="_blank" rel="noopener noreferrer">
            {t('trustChannel')}
          </a>
        </p>
      </section>

      <section className="home-section" aria-labelledby="home-how">
        <h2 id="home-how" className="home-section-title">
          {t('workflow')}
        </h2>
        <ol className="home-steps">
          {STEPS.map((step) => (
            <li key={step.num} className="home-step">
              <span className="home-step-num" aria-hidden="true">
                {step.num}
              </span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section home-proof-section" aria-labelledby="home-proof">
        <div className="home-section-heading">
          <h2 id="home-proof" className="home-section-title">
            {t('proofTitle', { appName: PLATFORM.name })}
          </h2>
          <p className="home-section-copy">
            {t('proofCopy', { channelName: DEMO_CHANNEL.name })}
          </p>
        </div>

        <div className="home-proof-layout">
          <div className="home-proof-visual">
            {demoVideoId ? (
              <div className="home-demo-embed">
                <iframe
                  title={`${DEMO_CHANNEL.name} — ${PLATFORM.name}`}
                  src={`https://www.youtube-nocookie.com/embed/${demoVideoId}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="home-pipeline" role="img" aria-label={t('proofPipelineLabel')}>
                <p className="home-pipeline-label">{t('proofPipelineLabel')}</p>
                <ol className="home-pipeline-track">
                  {PIPELINE_STEPS.map((label, i) => (
                    <li key={label} className="home-pipeline-node">
                      <span className="home-pipeline-dot" aria-hidden="true" />
                      <span className="home-pipeline-name">{label}</span>
                      {i < PIPELINE_STEPS.length - 1 ? (
                        <span className="home-pipeline-connector" aria-hidden="true" />
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <article className="home-case-study">
            <h3>{t('demoChannelTagline')}</h3>
            <p>{t('demoChannelDesc')}</p>
            <ul className="home-pricing-list">
              {DEMO_FEATURES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="home-actions home-case-actions">
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
              <article
                key={plan.id}
                className={`card home-pricing-card${plan.featured ? ' home-pricing-card-featured' : ''}`}
              >
                <div className="home-pricing-top">
                  <div>
                    <h3>{plan.name}</h3>
                    <p>{plan.description}</p>
                  </div>
                  {plan.badge ? <span className="home-pricing-badge">{plan.badge}</span> : null}
                </div>
                <div className="home-pricing-price">{plan.priceLabel}</div>
                <ul className="home-pricing-list">
                  {plan.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link
                  href={plan.id === 'unlimited' ? `mailto:${PLATFORM.contactEmail}` : '/register'}
                  className={plan.featured ? 'btn btn-primary' : 'btn btn-secondary'}
                >
                  {plan.ctaLabel}
                </Link>
              </article>
            ))}
          </div>
        </div>

        <p className="home-pricing-aside">{t('pricingAside')}</p>
      </section>

      <section className="home-section" aria-labelledby="home-faq">
        <h2 id="home-faq" className="home-section-title">
          {t('faq')}
        </h2>
        <div className="home-faq-list">
          {FAQ.map((item) => (
            <details key={item.q} className="home-faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="home-final-cta" aria-labelledby="home-final">
        <h2 id="home-final">{t('finalCtaTitle')}</h2>
        <p>{t('finalCtaCopy')}</p>
        <Link href="/register" className="btn btn-primary btn-lg">
          {t('startTrial')}
        </Link>
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
