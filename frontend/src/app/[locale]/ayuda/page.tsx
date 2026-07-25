import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PLATFORM } from '@/lib/site-brand';
import { HelpHome } from '@/components/ayuda/HelpHome';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const tn = await getTranslations({ locale, namespace: 'nav' });
  const th = await getTranslations({ locale, namespace: 'help' });
  return {
    title: tn('help'),
    description: th('pageDescription', { appName: PLATFORM.name }),
  };
}

export default function AyudaPage() {
  return <HelpHome />;
}
