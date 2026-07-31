'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { AdminOrgs } from '@/components/admin/AdminOrgs';
import { AdminUsers } from '@/components/admin/AdminUsers';
import { AdminBilling } from '@/components/admin/AdminBilling';
import { AdminInfra } from '@/components/admin/AdminInfra';
import { AdminSecrets } from '@/components/admin/AdminSecrets';
import type { StorageStats } from '@/lib/api';

const SECTION_IDS = ['overview', 'secrets', 'organizations', 'users', 'billing', 'infra'] as const;
type SectionId = (typeof SECTION_IDS)[number];

const TAB_ALIASES: Record<string, SectionId> = {
  overview: 'overview',
  resumen: 'overview',
  secrets: 'secrets',
  secretos: 'secrets',
  organizations: 'organizations',
  orgs: 'organizations',
  organizaciones: 'organizations',
  users: 'users',
  usuarios: 'users',
  billing: 'billing',
  facturacion: 'billing',
  infra: 'infra',
};

function AdminTabs({ storage }: { storage: StorageStats | null }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab')?.toLowerCase() ?? '';
  const initial = TAB_ALIASES[tabParam] ?? 'overview';
  const [activeSection, setActiveSection] = useState<SectionId>(initial);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    searchParams?.get('org') ?? null,
  );

  useEffect(() => {
    const next = TAB_ALIASES[tabParam];
    if (next) setActiveSection(next);
    setSelectedOrgId(searchParams?.get('org') ?? null);
  }, [tabParam, searchParams]);

  function selectSection(id: SectionId, orgId?: string | null) {
    setActiveSection(id);
    if (orgId !== undefined) setSelectedOrgId(orgId);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', id);
    if (orgId) params.set('org', orgId);
    else params.delete('org');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <>
      <nav className="settings-nav" aria-label={t('sectionsNav')}>
        <div className="settings-nav-chips" role="tablist">
          {SECTION_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeSection === id}
              className={`settings-nav-item${activeSection === id ? ' settings-nav-item-active' : ''}`}
              onClick={() => selectSection(id, id === 'organizations' ? selectedOrgId : null)}
            >
              {t(`${id}.title`)}
            </button>
          ))}
        </div>
        <ul className="settings-nav-sidebar">
          {SECTION_IDS.map((id) => (
            <li key={id}>
              <button
                type="button"
                role="tab"
                className={`settings-nav-item${activeSection === id ? ' settings-nav-item-active' : ''}`}
                aria-selected={activeSection === id}
                aria-current={activeSection === id ? 'page' : undefined}
                onClick={() => selectSection(id, id === 'organizations' ? selectedOrgId : null)}
              >
                {t(`${id}.title`)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="settings-content" role="tabpanel">
        {activeSection === 'overview' && <AdminOverview />}
        {activeSection === 'secrets' && <AdminSecrets />}
        {activeSection === 'organizations' && (
          <AdminOrgs
            selectedOrgId={selectedOrgId}
            onSelectOrg={(id) => selectSection('organizations', id)}
            onClearOrg={() => selectSection('organizations', null)}
          />
        )}
        {activeSection === 'users' && <AdminUsers />}
        {activeSection === 'billing' && <AdminBilling />}
        {activeSection === 'infra' && <AdminInfra storage={storage} />}
      </div>
    </>
  );
}

export function AdminLayout({ storage }: { storage: StorageStats | null }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const { session, loading } = useAuth();

  if (loading) {
    return <Skeleton style={{ height: '12rem', borderRadius: 12 }} aria-hidden="true" />;
  }

  if (!session) {
    return <p className="text-muted">{t('loginRequired')}</p>;
  }

  if (!session.isPlatformAdmin) {
    return <p className="text-muted">{t('forbidden')}</p>;
  }

  return (
    <div className="settings-layout">
      <div className="settings-body">
        <Suspense
          fallback={
            <p className="text-muted text-sm" aria-busy="true">
              {tc('loading')}
            </p>
          }
        >
          <AdminTabs storage={storage} />
        </Suspense>
      </div>
    </div>
  );
}
