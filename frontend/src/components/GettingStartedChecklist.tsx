'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';

export interface GettingStartedChecklistProps {
  hasChannels: boolean;
  hasIntegrations: boolean;
  hasGenerations: boolean;
  firstChannelId?: string;
}

export function GettingStartedChecklist(props: GettingStartedChecklistProps) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');

  const allDone = props.hasChannels && props.hasIntegrations && props.hasGenerations;
  if (allDone) return null;

  const STEPS = [
    {
      key: 'channel',
      number: 1,
      title: t('stepChannelTitle'),
      description: t('stepChannelDesc'),
      href: () => '/channels',
      done: () => props.hasChannels,
      cta: tc('goToChannels'),
    },
    {
      key: 'integrations',
      number: 2,
      title: t('stepIntegrationsTitle'),
      description: t('stepIntegrationsDesc'),
      href: () =>
        props.firstChannelId
          ? `/channels/${props.firstChannelId}?tab=integraciones`
          : '/channels',
      done: () => props.hasIntegrations,
      cta: t('connectYoutube'),
    },
    {
      key: 'generate',
      number: 3,
      title: t('stepGenerateTitle'),
      description: t('stepGenerateDesc'),
      href: () => (props.firstChannelId ? `/channels/${props.firstChannelId}` : '/channels'),
      done: () => props.hasGenerations,
      cta: tc('generateVideo'),
    },
  ] as const;

  const completedCount = STEPS.filter((s) => s.done()).length;
  const progressPct = Math.round((completedCount / STEPS.length) * 100);
  const activeIndex = !props.hasChannels ? 0 : !props.hasIntegrations ? 1 : !props.hasGenerations ? 2 : STEPS.length;

  return (
    <section className="getting-started card" aria-labelledby="getting-started-title">
      <header className="getting-started-header">
        <div>
          <h2 id="getting-started-title">{t('gettingStartedTitle')}</h2>
          <p className="getting-started-subtitle">
            {t('stepProgress', {
              current: Math.min(activeIndex + 1, STEPS.length),
              total: STEPS.length,
              completed: completedCount,
              completedSuffix: completedCount === 1 ? '' : 's',
            })}
          </p>
        </div>
      </header>

      <div
        className="getting-started-progress"
        role="progressbar"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={STEPS.length}
        aria-label={t('onboardingProgressAria')}
      >
        <div
          className="getting-started-progress-fill"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ol className="getting-started-steps">
        {STEPS.map((step, index) => {
          const done = step.done();
          const active = !done && index === activeIndex;
          const href = step.href();
          return (
            <li
              key={step.key}
              className={[
                'getting-started-step',
                done ? 'getting-started-step-done' : '',
                active ? 'getting-started-step-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="getting-started-step-number" aria-hidden="true">
                {done ? '✓' : step.number}
              </span>
              <div className="getting-started-step-body">
                <h3>
                  {step.title}
                  {active && (
                    <span className="getting-started-step-badge">{t('nextStepBadge')}</span>
                  )}
                </h3>
                <p>{step.description}</p>
                {!done && (
                  <ButtonLink href={href} variant={active ? 'primary' : 'secondary'} size="sm">
                    {step.cta}
                  </ButtonLink>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {props.hasChannels && !props.hasIntegrations && (
        <p className="getting-started-footnote text-muted text-sm">
          {t.rich('footnoteIntegrations', {
            link: (chunks) => (
              <Link
                href={
                  props.firstChannelId
                    ? `/channels/${props.firstChannelId}?tab=integraciones`
                    : '/channels'
                }
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}

      {props.hasChannels && props.hasIntegrations && !props.hasGenerations && (
        <p className="getting-started-footnote text-muted text-sm">
          {t('footnoteGenerate')}
        </p>
      )}
    </section>
  );
}
