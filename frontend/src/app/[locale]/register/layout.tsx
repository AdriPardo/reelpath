import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  const tn = await getTranslations({ locale, namespace: 'nav' });
  return {
    title: tn('register'),
    description: t('registerOrgDescription'),
  };
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <div className="auth-layout">{children}</div>;
}
