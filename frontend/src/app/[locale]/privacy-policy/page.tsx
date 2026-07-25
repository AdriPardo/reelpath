import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PrivacyPolicyArticle } from '@/components/legal/LegalArticles';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
  };
}

export default async function PrivacyPolicyPage({ params }: Props) {
  const { locale } = await params;
  return <PrivacyPolicyArticle locale={locale} />;
}
