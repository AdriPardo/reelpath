import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import type { StorageStats } from '@/lib/api';
import { serverApi } from '@/lib/api-server';
import type { PlanDefinition } from '@/lib/plan-limits';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ dev?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settings' });
  return { title: t('title') };
}

export default async function SettingsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settings' });
  const { dev } = await searchParams;
  const showDev = dev === '1';

  let plans: PlanDefinition[] = [];
  try {
    plans = await serverApi<PlanDefinition[]>('/api/billing/plans');
  } catch {
    // offline parcial
  }

  let storage: StorageStats | null = null;
  if (showDev) {
    try {
      storage = await serverApi<StorageStats>('/api/system/storage');
    } catch {
      // offline parcial
    }
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <SettingsLayout plans={plans} showDev={showDev} storage={storage} />
    </>
  );
}
