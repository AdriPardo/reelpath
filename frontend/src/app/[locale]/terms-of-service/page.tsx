import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TermsOfServiceArticle } from '@/components/legal/LegalArticles';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
  };
}

export default async function TermsOfServicePage({ params }: Props) {
  const { locale } = await params;
  return <TermsOfServiceArticle locale={locale} />;
}
