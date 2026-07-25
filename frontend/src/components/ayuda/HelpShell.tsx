import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import { getHelpHome, type HelpCategorySlug } from '@/lib/help/help-content';
import { HelpShellClient } from './HelpShellClient';

type Crumb = { href: string; label: string };

export async function HelpShell({
  children,
  breadcrumb,
  currentNav,
  rightPane,
}: {
  children: ReactNode;
  breadcrumb: Crumb[];
  currentNav:
    | { type: 'home' }
    | { type: 'category'; slug: HelpCategorySlug }
    | { type: 'article'; slug: string; categorySlug: HelpCategorySlug };
  rightPane: ReactNode | null;
}) {
  const locale = (await getLocale()) as 'es' | 'en';
  const home = getHelpHome(locale);

  const categories = home.categories
    .filter((c) => c.articleCount > 0)
    .map((c) => ({
      slug: c.slug,
      title: c.title,
      icon: c.icon,
      href: c.href,
      articleCount: c.articleCount,
    }));

  const featured = home.featured.slice(0, 4).map((a) => ({
    href: a.href,
    title: a.title,
  }));

  return (
    <HelpShellClient
      breadcrumb={breadcrumb}
      currentNav={currentNav}
      rightPane={rightPane}
      categories={categories}
      featured={featured}
    >
      {children}
    </HelpShellClient>
  );
}
