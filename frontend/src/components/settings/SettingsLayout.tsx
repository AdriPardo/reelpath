'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import type { StorageStats } from '@/lib/api';
import type { PlanDefinition } from '@/lib/plan-limits';
import { Skeleton } from '@/components/ui/Skeleton';
import { SettingsAccountPanel } from '@/components/settings/SettingsAccountPanel';
import { SettingsBillingNotice } from '@/components/settings/SettingsBillingNotice';
import { SettingsDevPanel } from '@/components/settings/SettingsDevPanel';
import { SettingsPlanPanel } from '@/components/settings/SettingsPlanPanel';
import { SettingsPreferencesPanel } from '@/components/settings/SettingsPreferencesPanel';
import { SettingsPublicationPanel } from '@/components/settings/SettingsPublicationPanel';
import { SettingsTeamPanel } from '@/components/settings/SettingsTeamPanel';
import { SettingsApiKeysPanel } from '@/components/settings/SettingsApiKeysPanel';

const SECTION_IDS = ['account', 'team', 'apikeys', 'plan', 'preferences', 'publication'] as const;
type SectionId = (typeof SECTION_IDS)[number];

const TAB_ALIASES: Record<string, SectionId> = {
  account: 'account',
  team: 'team',
  equipo: 'team',
  apikeys: 'apikeys',
  api: 'apikeys',
  plan: 'plan',
  planes: 'plan',
  preferences: 'preferences',
  preferencias: 'preferences',
  publication: 'publication',
  publicacion: 'publication',
};

function profileInitial(name: string | null | undefined, email: string): string {
  const source = (name?.trim() || email).trim();
  return source.charAt(0).toUpperCase() || '?';
}

function SettingsTabs({ plans }: { plans: PlanDefinition[] }) {
  const t = useTranslations('settings');
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab')?.toLowerCase() ?? '';
  const initial = TAB_ALIASES[tabParam] ?? 'account';
  const [activeSection, setActiveSection] = useState<SectionId>(initial);

  useEffect(() => {
    const next = TAB_ALIASES[tabParam];
    if (next) setActiveSection(next);
  }, [tabParam]);

  return (
    <>
      <nav className="settings-nav" aria-label={t('sectionsNav')}>
        <div className="settings-nav-chips" role="tablist">
          {SECTION_IDS.map((id) => {
            const label = t.has(`${id}.title`) ? t(`${id}.title`) : t(id);
            return (
              <button
                key={id}
                type="button"
                role="tab"
                data-testid={`settings-tab-${id}`}
                aria-selected={activeSection === id}
                className={`settings-nav-item${activeSection === id ? ' settings-nav-item-active' : ''}`}
                onClick={() => setActiveSection(id)}
              >
                {label}
              </button>
            );
          })}
        </div>
        <ul className="settings-nav-sidebar">
          {SECTION_IDS.map((id) => {
            const label = t.has(`${id}.title`) ? t(`${id}.title`) : t(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  role="tab"
                  data-testid={`settings-tab-side-${id}`}
                  className={`settings-nav-item${activeSection === id ? ' settings-nav-item-active' : ''}`}
                  aria-selected={activeSection === id}
                  aria-current={activeSection === id ? 'page' : undefined}
                  onClick={() => setActiveSection(id)}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="settings-content" role="tabpanel">
        {activeSection === 'account' && <SettingsAccountPanel />}
        {activeSection === 'team' && <SettingsTeamPanel />}
        {activeSection === 'apikeys' && <SettingsApiKeysPanel />}
        {activeSection === 'plan' && <SettingsPlanPanel plans={plans} />}
        {activeSection === 'preferences' && <SettingsPreferencesPanel />}
        {activeSection === 'publication' && <SettingsPublicationPanel />}
      </div>
    </>
  );
}

export function SettingsLayout({
  plans,
  showDev,
  storage,
}: {
  plans: PlanDefinition[];
  showDev: boolean;
  storage: StorageStats | null;
}) {
  const tc = useTranslations('common');
  const { session, loading } = useAuth();

  const user = session?.user;
  const displayName = user?.name?.trim() || tc('noName');
  const email = user?.email ?? '';

  return (
    <div className="settings-layout">
      <Suspense fallback={null}>
        <SettingsBillingNotice />
      </Suspense>

      {!loading && user ? (
        <header className="settings-profile">
          <div className="settings-avatar" aria-hidden="true">
            {profileInitial(user.name, user.email)}
          </div>
          <div className="settings-profile-text">
            <p className="settings-profile-name">{displayName}</p>
            <p className="settings-profile-email">{email}</p>
          </div>
        </header>
      ) : loading ? (
        <Skeleton style={{ height: '4.5rem', borderRadius: 12, marginBottom: '1.25rem' }} aria-hidden="true" />
      ) : null}

      <div className="settings-body">
        <Suspense
          fallback={
            <p className="text-muted text-sm" aria-busy="true">
              {tc('loading')}
            </p>
          }
        >
          <SettingsTabs plans={plans} />
        </Suspense>
      </div>

      {showDev && <SettingsDevPanel storage={storage} />}
    </div>
  );
}
