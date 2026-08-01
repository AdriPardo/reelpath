'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PLATFORM } from '@/lib/site-brand';

interface HelpSection {
  id: string;
  title: string;
  summary: string;
  content: React.ReactNode;
}

function Callout({
  type,
  children,
}: {
  type: 'tip' | 'warn';
  children: React.ReactNode;
}) {
  return (
    <p className={`help-callout help-callout-${type}`}>
      <span aria-hidden="true">{type === 'tip' ? '💡' : '⚠️'}</span> {children}
    </p>
  );
}

function HelpTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="help-table-wrap">
      <table className="help-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionBlock({ section, defaultOpen }: { section: HelpSection; defaultOpen?: boolean }) {
  return (
    <details id={section.id} className="help-section" open={defaultOpen}>
      <summary className="help-section-summary">
        <span className="help-section-title">{section.title}</span>
        <span className="help-section-lead">{section.summary}</span>
      </summary>
      <div className="help-section-body">{section.content}</div>
    </details>
  );
}

function useHelpSections(): HelpSection[] {
  const t = useTranslations('help.center');
  const tl = useTranslations('help.center.links');

  return useMemo(
    () => [
      {
        id: 'que-es',
        title: t('whatIs.title'),
        summary: t('whatIs.summary'),
        content: (
          <>
            <p>{t('whatIs.p1', { platform: PLATFORM.name })}</p>
            <p>{PLATFORM.tagline}</p>
            <HelpTable
              headers={[t('whatIs.tableH1'), t('whatIs.tableH2')]}
              rows={[
                [t('whatIs.r1c1'), t('whatIs.r1c2')],
                [t('whatIs.r2c1'), t('whatIs.r2c2')],
                [t('whatIs.r3c1'), t('whatIs.r3c2')],
              ]}
            />
          </>
        ),
      },
      {
        id: 'empezar',
        title: t('gettingStarted.title'),
        summary: t('gettingStarted.summary'),
        content: (
          <>
            <h4>{t('gettingStarted.registerH')}</h4>
            <ol className="help-steps">
              <li>
                <Link href="/register">{tl('register')}</Link> — {t('gettingStarted.step1')}
              </li>
              <li>{t('gettingStarted.step2')}</li>
              <li>{t('gettingStarted.step3')}</li>
            </ol>
            <h4>{t('gettingStarted.checklistH')}</h4>
            <HelpTable
              headers={[t('gettingStarted.thStep'), t('gettingStarted.thAction'), t('gettingStarted.thWhere')]}
              rows={[
                [t('gettingStarted.c1'), t('gettingStarted.c2'), t('gettingStarted.c3')],
                [t('gettingStarted.c4'), t('gettingStarted.c5'), t('gettingStarted.c6')],
                [t('gettingStarted.c7'), t('gettingStarted.c8'), t('gettingStarted.c9')],
              ]}
            />
            <Callout type="tip">{t('gettingStarted.tip')}</Callout>
          </>
        ),
      },
      {
        id: 'cuenta',
        title: t('account.title'),
        summary: t('account.summary'),
        content: (
          <>
            <p>
              {t('account.p1Before')}{' '}
              <Link href="/settings">{tl('settingsPlan')}</Link>.
            </p>
            <h4>{t('account.trialH')}</h4>
            <HelpTable
              headers={[t('account.thResource'), t('account.thLimit')]}
              rows={[
                [t('account.channels'), '1'],
                [t('account.videosMonth'), '8'],
                [t('account.genDay'), '2'],
                [t('account.price'), t('account.free')],
              ]}
            />
            <h4>{t('account.plansH')}</h4>
            <HelpTable
              headers={[t('account.thPlan'), t('account.thPrice'), t('account.channels'), t('account.videosMonth'), t('account.genDay')]}
              rows={[
                [t('account.creator'), '79 €/mes', '1', '8', '2'],
                [t('account.pro'), '149 €/mes', '3', '24', '4'],
                [t('account.studio'), '399 €/mes', t('account.unlimited'), t('account.unlimited'), t('account.unlimitedF')],
              ]}
            />
            <p>{t('account.p2')}</p>
            <Callout type="warn">{t('account.warn')}</Callout>
          </>
        ),
      },
      {
        id: 'canales',
        title: t('channels.title'),
        summary: t('channels.summary'),
        content: (
          <>
            <h4>{t('channels.createH')}</h4>
            <ol className="help-steps">
              <li>
                <Link href="/channels">{tl('channels')}</Link> — {t('channels.createStep')}
              </li>
            </ol>
            <h4>{t('channels.tabsH')}</h4>
            <p>{t('channels.tabs')}</p>
            <h4>{t('channels.complianceH')}</h4>
            <ul>
              <li>{t('channels.forbidden')}</li>
              <li>{t('channels.aiHints')}</li>
              <li>{t('channels.disclaimer')}</li>
            </ul>
            <h4>{t('channels.visualH')}</h4>
            <HelpTable
              headers={[t('channels.thMode'), t('channels.thDesc')]}
              rows={[
                [t('channels.aiImages'), t('channels.aiImagesDesc')],
                [t('channels.stock'), t('channels.stockDesc')],
                [t('channels.mixed'), t('channels.mixedDesc')],
              ]}
            />
            <Callout type="tip">{t('channels.tip')}</Callout>
          </>
        ),
      },
      {
        id: 'youtube',
        title: t('youtube.title'),
        summary: t('youtube.summary'),
        content: (
          <>
            <ol className="help-steps">
              <li>{t('youtube.step1')}</li>
              <li>{t('youtube.step2')}</li>
              <li>{t('youtube.step3')}</li>
              <li>{t('youtube.step4')}</li>
            </ol>
            <Callout type="warn">{t('youtube.warn')}</Callout>
            <p>{t('youtube.reconnect')}</p>
          </>
        ),
      },
      {
        id: 'generar',
        title: t('generate.title'),
        summary: t('generate.summary'),
        content: (
          <>
            <ol className="help-steps">
              <li>{t('generate.step1')}</li>
              <li>{t('generate.step2')}</li>
              <li>{t('generate.step3')}</li>
              <li>
                {t('generate.step4Before')}{' '}
                <Link href="/pipelines">{tl('pipelines')}</Link>.
              </li>
            </ol>
            <h4>{t('generate.stagesH')}</h4>
            <p>{t('generate.stages')}</p>
            <p>{t('generate.timing')}</p>
          </>
        ),
      },
      {
        id: 'publicar',
        title: t('publish.title'),
        summary: t('publish.summary'),
        content: (
          <>
            <p>
              <Link href="/review">{tl('review')}</Link> {t('publish.intro')}
            </p>
            <HelpTable
              headers={[t('publish.thAction'), t('publish.thResult')]}
              rows={[
                [t('publish.publishNow'), t('publish.publishNowR')],
                [t('publish.approveSchedule'), t('publish.approveScheduleR')],
                [t('publish.reject'), t('publish.rejectR')],
              ]}
            />
            <h4>{t('publish.modalH')}</h4>
            <ul>
              <li>{t('publish.usePlanner')}</li>
              <li>{t('publish.modalPublishNow')}</li>
              <li>{t('publish.manualDate')}</li>
            </ul>
            <h4>{t('publish.uploadH')}</h4>
            <p>{t('publish.uploadP')}</p>
          </>
        ),
      },
      {
        id: 'shorts',
        title: t('shorts.title'),
        summary: t('shorts.summary'),
        content: (
          <>
            <p>{t('shorts.p1')}</p>
            <HelpTable
              headers={[t('shorts.thMode'), t('shorts.thProduces')]}
              rows={[
                [t('shorts.split'), t('shorts.splitR')],
                [t('shorts.dedicated'), t('shorts.dedicatedR')],
                [t('shorts.mixed'), t('shorts.mixedR')],
              ]}
            />
            <p>{t('shorts.p2')}</p>
          </>
        ),
      },
      {
        id: 'analiticas',
        title: t('analytics.title'),
        summary: t('analytics.summary'),
        content: (
          <>
            <HelpTable
              headers={[t('analytics.thLocation'), t('analytics.thContent')]}
              rows={[
                [t('analytics.home'), t('analytics.homeR')],
                [t('analytics.channel'), t('analytics.channelR')],
                [t('analytics.video'), t('analytics.videoR')],
              ]}
            />
            <p>{t('analytics.sync')}</p>
            <Callout type="warn">{t('analytics.warn')}</Callout>
          </>
        ),
      },
      {
        id: 'planner',
        title: t('planner.title'),
        summary: t('planner.summary'),
        content: (
          <>
            <p>{t('planner.p1')}</p>
            <ul>
              <li>{t('planner.tz')}</li>
              <li>{t('planner.maxLongs')}</li>
              <li>{t('planner.hour')}</li>
              <li>{t('planner.days')}</li>
              <li>{t('planner.spacing')}</li>
            </ul>
            <p>{t('planner.p2')}</p>
          </>
        ),
      },
      {
        id: 'equipo',
        title: t('team.title'),
        summary: t('team.summary'),
        content: (
          <>
            <p>
              <Link href="/settings">{tl('settingsTeam')}</Link>
            </p>
            <ol className="help-steps">
              <li>{t('team.step1')}</li>
              <li>{t('team.step2')}</li>
              <li>{t('team.step3')}</li>
            </ol>
            <HelpTable
              headers={[t('team.thRole'), t('team.thPerms')]}
              rows={[
                [t('team.owner'), t('team.ownerR')],
                [t('team.admin'), t('team.adminR')],
                [t('team.member'), t('team.memberR')],
              ]}
            />
          </>
        ),
      },
      {
        id: 'faq',
        title: t('faq.title'),
        summary: t('faq.summary'),
        content: (
          <dl className="help-faq">
            <dt>{t('faq.q1')}</dt>
            <dd>{t('faq.a1')}</dd>
            <dt>{t('faq.q2')}</dt>
            <dd>{t('faq.a2')}</dd>
            <dt>{t('faq.q3')}</dt>
            <dd>{t('faq.a3')}</dd>
            <dt>{t('faq.q4')}</dt>
            <dd>{t('faq.a4')}</dd>
          </dl>
        ),
      },
      {
        id: 'problemas',
        title: t('problems.title'),
        summary: t('problems.summary'),
        content: (
          <HelpTable
            headers={[t('problems.thProblem'), t('problems.thSolution')]}
            rows={[
              [t('problems.p1'), t('problems.s1')],
              [t('problems.p2'), t('problems.s2')],
              [t('problems.p3'), t('problems.s3')],
              [t('problems.p4'), t('problems.s4')],
              [t('problems.p5'), t('problems.s5')],
            ]}
          />
        ),
      },
      {
        id: 'glosario',
        title: t('glossary.title'),
        summary: t('glossary.summary'),
        content: (
          <HelpTable
            headers={[t('glossary.thTerm'), t('glossary.thMeaning')]}
            rows={[
              [t('glossary.gen'), t('glossary.genM')],
              [t('glossary.planner'), t('glossary.plannerM')],
              [t('glossary.shorts'), t('glossary.shortsM')],
              [t('glossary.teaser'), t('glossary.teaserM')],
              [t('glossary.review'), t('glossary.reviewM')],
              [t('glossary.voice'), t('glossary.voiceM')],
            ]}
          />
        ),
      },
    ],
    [t, tl],
  );
}

export function HelpCenter() {
  const t = useTranslations('help.center');
  const sections = useHelpSections();
  const [query, setQuery] = useState('');

  const quickLinks = [
    { href: '#empezar', label: t('nav.gettingStarted') },
    { href: '#cuenta', label: t('nav.account') },
    { href: '#canales', label: t('nav.channels') },
    { href: '#youtube', label: t('nav.youtube') },
    { href: '#generar', label: t('nav.generate') },
    { href: '#publicar', label: t('nav.publish') },
    { href: '#shorts', label: t('nav.shorts') },
    { href: '#analiticas', label: t('nav.analytics') },
    { href: '#planner', label: t('nav.planner') },
    { href: '#equipo', label: t('nav.team') },
    { href: '#faq', label: t('nav.faq') },
    { href: '#problemas', label: t('nav.problems') },
    { href: '#glosario', label: t('nav.glossary') },
  ];

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? sections.filter(
        (s) =>
          s.title.toLowerCase().includes(normalizedQuery) ||
          s.summary.toLowerCase().includes(normalizedQuery) ||
          s.id.includes(normalizedQuery),
      )
    : sections;

  return (
    <div className="help-center">
      <header className="help-hero card">
        <h1>{t('title')}</h1>
        <p className="help-intro">{t('intro', { platform: PLATFORM.name })}</p>
        <label className="help-search">
          <span className="sr-only">{t('searchLabel')}</span>
          <input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>

      <nav className="help-toc card" aria-label={t('searchLabel')}>
        <h2 className="help-toc-title">{t('tocTitle')}</h2>
        <ul className="help-toc-list">
          {quickLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="help-sections">
        {filtered.length === 0 ? (
          <p className="help-empty">{t('emptyResults', { query })}</p>
        ) : (
          filtered.map((section, index) => (
            <SectionBlock key={section.id} section={section} defaultOpen={index === 0 && !query} />
          ))
        )}
      </div>

      <footer className="help-footer card">
        <p>
          {t('footerNeedHelp')}{' '}
          <a href={`mailto:${PLATFORM.contactEmail}`}>{PLATFORM.contactEmail}</a>.
        </p>
        <p className="help-footer-links">
          <Link href="/terms-of-service">{t('footerTerms')}</Link>
          {' · '}
          <Link href="/privacy-policy">{t('footerPrivacy')}</Link>
          {' · '}
          <Link href="/">{t('footerHome')}</Link>
        </p>
      </footer>
    </div>
  );
}
