import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import type { StorageStats } from '@/lib/api';
import { serverApi } from '@/lib/api-server';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin' });
  return { title: t('title') };
}

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin' });

  let storage: StorageStats | null = null;
  try {
    storage = await serverApi<StorageStats>('/api/system/storage');
  } catch {
    // offline parcial / sin permisos en SSR
  }

  return (
    <div className="page-content">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <AdminLayout storage={storage} />
    </div>
  );
}
