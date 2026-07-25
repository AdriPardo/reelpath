import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getHelpArticleBySlug } from '@/lib/help/help-content';
import { HelpArticle } from '@/components/ayuda/HelpArticle';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const article = getHelpArticleBySlug(slug, locale as 'es' | 'en');
  if (!article) return { title: 'Help' };
  return {
    title: article.title,
    description: article.description,
  };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const article = getHelpArticleBySlug(slug, locale as 'es' | 'en');
  if (!article) notFound();
  return <HelpArticle article={article} />;
}
