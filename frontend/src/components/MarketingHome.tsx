'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { SkeletonHeader, SkeletonStats } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { DEMO_CHANNEL, LEGAL_URLS, PLATFORM } from '@/lib/site-brand';

function useHomeMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.querySelectorAll('.home-reveal').forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const targets = root.querySelectorAll<HTMLElement>('.home-reveal');
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    targets.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [rootRef]);
}

export function MarketingHome() {
  const t = useTranslations('landing');
  const tc = useTranslations('common');
  const { session, loading } = useAuth();
  const router = useRouter();
  const refreshed = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useHomeMotion(rootRef);

  // Cliente con sesión + RSC landing (cookie/SSR): revalidar una vez; si sigue, entrar a /channels.
  useEffect(() => {
    if (loading || !session || refreshed.current) return;
    refreshed.current = true;
    router.refresh();
    const timer = window.setTimeout(() => {
      router.replace('/channels');
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [loading, session, router]);

  if (loading || session) {
    return (
      <div className="page-content" aria-busy="true" aria-label={tc('loadingSession')}>
        <SkeletonHeader />
        <SkeletonStats count={3} />
      </div>
    );
  }

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

  const CAPABILITIES = [
    { title: t('capScriptTitle'), desc: t('capScriptDesc') },
    { title: t('capMediaTitle'), desc: t('capMediaDesc') },
    { title: t('capReviewTitle'), desc: t('capReviewDesc') },
    { title: t('capPublishTitle'), desc: t('capPublishDesc') },
  ];

  const AUDIENCE = [
    { title: t('audienceEduTitle'), desc: t('audienceEduDesc') },
    { title: t('audienceSoloTitle'), desc: t('audienceSoloDesc') },
    { title: t('audienceStudioTitle'), desc: t('audienceStudioDesc') },
  ];

  const PLANS = [
    {
      id: 'starter',
      name: t('planCreator'),
      desc: t('planCreatorDesc'),
      amount: t('priceCreatorValue'),
      period: t('priceCreatorPeriod'),
      bullets: [t('planCreatorBullet1'), t('planCreatorBullet2'), t('planCreatorBullet3')],
      ctaLabel: t('planCreatorCta'),
      featured: false,
    },
    {
      id: 'pro',
      name: t('planPro'),
      desc: t('planProDesc'),
      amount: t('priceProValue'),
      period: t('priceProPeriod'),
      badge: t('planProBadge'),
      bullets: [t('planProBullet1'), t('planProBullet2'), t('planProBullet3')],
      ctaLabel: t('planProCta'),
      featured: true,
    },
    {
      id: 'unlimited',
      name: t('planStudio'),
      desc: t('planStudioDesc'),
      amount: t('priceStudioValue'),
      period: t('priceStudioPeriod'),
      bullets: [t('planStudioBullet1'), t('planStudioBullet2'), t('planStudioBullet3')],
      ctaLabel: t('planStudioCta'),
      featured: false,
    },
  ] as const;

  const FAQ = [
    { q: t('faqAiQ'), a: t('faqAiA') },
    { q: t('faqControlQ'), a: t('faqControlA') },
    { q: t('faqEducationalQ'), a: t('faqEducationalA', { channelName: DEMO_CHANNEL.name }) },
    { q: t('faqCopyrightQ'), a: t('faqCopyrightA') },
  ] as const;

  const demoVideoId = DEMO_CHANNEL.demoYoutubeVideoId.trim();

  return (
    <div className="home" ref={rootRef}>
      <section className="home-hero home-bleed">
        <div className="home-hero-glow" aria-hidden="true" />
        <div className="home-hero-grid" aria-hidden="true" />
        <div className="home-shell home-hero-inner">
          <p className="home-brand-mark home-hero-enter" style={{ ['--home-delay' as string]: '0ms' }}>
            {PLATFORM.name}
          </p>
          <h1 className="home-title home-hero-enter" style={{ ['--home-delay' as string]: '80ms' }}>
            {t('heroOutcome')}
          </h1>
          <p className="home-tagline home-hero-enter" style={{ ['--home-delay' as string]: '160ms' }}>
            {t('heroSupport')}
          </p>
          <div className="home-actions home-hero-enter" style={{ ['--home-delay' as string]: '240ms' }}>
            <Link href="/register" className="btn btn-primary btn-lg">
              {t('startTrial')}
            </Link>
            <Link href="/login" className="home-login-link">
              {t('login')}
            </Link>
          </div>
          <p className="home-trust-line home-hero-enter" style={{ ['--home-delay' as string]: '320ms' }}>
            <span>{t('trustTrial')}</span>
            <span aria-hidden="true">·</span>
            <a href={DEMO_CHANNEL.youtubeUrl} target="_blank" rel="noopener noreferrer">
              {t('trustChannel')}
            </a>
          </p>
        </div>
      </section>

      <section className="home-section home-bleed" aria-labelledby="home-saas">
        <div className="home-shell home-reveal">
          <h2 id="home-saas" className="home-section-title">
            {t('saasPillarTitle')}
          </h2>
          <p className="home-section-lead">{t('saasPillarLead')}</p>
          <div className="home-problem-grid">
            <p>{t('saasPillar1')}</p>
            <p>{t('saasPillar2')}</p>
            <p>{t('saasPillar3')}</p>
          </div>
        </div>
      </section>

      <section className="home-section home-bleed home-band" aria-labelledby="home-problem">
        <div className="home-shell home-reveal">
          <h2 id="home-problem" className="home-section-title">
            {t('problemTitle')}
          </h2>
          <p className="home-section-lead">{t('problemLead')}</p>
          <div className="home-problem-grid">
            <p>{t('problemPain1')}</p>
            <p>{t('problemPain2')}</p>
            <p>{t('problemPain3')}</p>
          </div>
        </div>
      </section>

      <section className="home-section home-shell" aria-labelledby="home-how">
        <div className="home-reveal">
          <h2 id="home-how" className="home-section-title">
            {t('workflow')}
          </h2>
          <ol className="home-steps">
            {STEPS.map((step, i) => (
              <li
                key={step.num}
                className="home-step home-reveal"
                style={{ ['--home-delay' as string]: `${i * 90}ms` }}
              >
                <span className="home-step-num" aria-hidden="true">
                  {step.num}
                </span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-section home-bleed home-band" aria-labelledby="home-caps">
        <div className="home-shell home-reveal">
          <div className="home-section-heading">
            <h2 id="home-caps" className="home-section-title">
              {t('capabilitiesTitle')}
            </h2>
            <p className="home-section-copy">{t('capabilitiesCopy')}</p>
          </div>
          <ul className="home-capability-grid">
            {CAPABILITIES.map((item, i) => (
              <li
                key={item.title}
                className="home-capability home-reveal"
                style={{ ['--home-delay' as string]: `${i * 70}ms` }}
              >
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home-section home-shell home-proof-section" aria-labelledby="home-proof">
        <div className="home-section-heading home-reveal">
          <h2 id="home-proof" className="home-section-title">
            {t('proofTitle', { appName: PLATFORM.name })}
          </h2>
          <p className="home-section-copy">
            {t('proofCopy', { channelName: DEMO_CHANNEL.name })}
          </p>
        </div>

        <div className="home-proof-layout home-reveal">
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

      <section className="home-section home-bleed home-band" aria-labelledby="home-audience">
        <div className="home-shell home-reveal">
          <h2 id="home-audience" className="home-section-title">
            {t('audienceTitle')}
          </h2>
          <ul className="home-audience-grid">
            {AUDIENCE.map((item, i) => (
              <li
                key={item.title}
                className="home-audience-item home-reveal"
                style={{ ['--home-delay' as string]: `${i * 80}ms` }}
              >
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home-section home-bleed home-band home-pricing-section" aria-labelledby="home-pricing">
        <div className="home-shell">
          <div className="home-section-heading home-reveal">
            <h2 id="home-pricing" className="home-section-title">
              {t('pricing')}
            </h2>
            <p className="home-section-copy">{t('pricingCopy')}</p>
          </div>

          <div className="home-pricing-grid" role="list">
            {PLANS.map((plan, i) => (
              <article
                key={plan.id}
                role="listitem"
                className={`home-plan-card home-reveal${plan.featured ? ' is-featured' : ''}`}
                style={{ ['--home-delay' as string]: `${i * 80}ms` }}
              >
                <header className="home-plan-head">
                  <div className="home-plan-name-row">
                    <h3>{plan.name}</h3>
                    {'badge' in plan && plan.badge ? (
                      <span className="home-pricing-badge">{plan.badge}</span>
                    ) : null}
                  </div>
                  <p className="home-plan-desc">{plan.desc}</p>
                </header>

                <p className="home-plan-price">
                  <span className="home-plan-amount">{plan.amount}</span>
                  <span className="home-plan-period">{plan.period}</span>
                </p>

                <ul className="home-pricing-list">
                  {plan.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <Link
                  href={plan.id === 'unlimited' ? `mailto:${PLATFORM.contactEmail}` : '/register'}
                  className={`home-pricing-cta ${plan.featured ? 'btn btn-primary' : 'btn btn-secondary'}`}
                >
                  {plan.ctaLabel}
                </Link>
              </article>
            ))}
          </div>

          <p className="home-pricing-aside home-reveal">{t('pricingAside')}</p>
        </div>
      </section>

      <section className="home-section home-shell" aria-labelledby="home-faq">
        <h2 id="home-faq" className="home-section-title home-reveal">
          {t('faq')}
        </h2>
        <div className="home-faq-list home-reveal">
          {FAQ.map((item) => (
            <details key={item.q} className="home-faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="home-final-cta home-bleed" aria-labelledby="home-final">
        <div className="home-shell home-reveal">
          <h2 id="home-final">{t('finalCtaTitle')}</h2>
          <p>{t('finalCtaCopy')}</p>
          <Link href="/register" className="btn btn-primary btn-lg">
            {t('startTrial')}
          </Link>
        </div>
      </section>

      <footer className="landing-footer home-shell">
        <Link href={LEGAL_URLS.terms}>{tc('termsOfService')}</Link>
        <span aria-hidden="true">·</span>
        <Link href={LEGAL_URLS.privacy}>{tc('privacyPolicy')}</Link>
        <span aria-hidden="true">·</span>
        <a href={`mailto:${PLATFORM.contactEmail}`}>{tc('contact')}</a>
      </footer>
    </div>
  );
}
