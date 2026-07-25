import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import { getHelpHome } from '@/lib/help/help-content';
import { HelpShell } from '@/components/ayuda/HelpShell';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const home = getHelpHome(locale as 'es' | 'en');
  const cat = home.categories.find((c) => c.slug === slug);
  const tn = await getTranslations({ locale, namespace: 'nav' });
  if (!cat) return { title: tn('help') };
  return { title: `${tn('help')} — ${cat.title}`, description: cat.description };
}

export default async function HelpCategoryPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const loc = locale as 'es' | 'en';
  const home = getHelpHome(loc);
  const cat = home.categories.find((c) => c.slug === slug);
  const tn = await getTranslations({ locale, namespace: 'nav' });
  if (!cat) notFound();

  const articles = home.articles.filter((a) => a.category === cat.slug);

  return (
    <HelpShell
      breadcrumb={[
        { href: '/ayuda', label: tn('help') },
        { href: cat.href, label: cat.title },
      ]}
      currentNav={{ type: 'category', slug: cat.slug }}
      rightPane={null}
    >
      <header className="help-list-header">
        <h1 className="help-list-title">{cat.title}</h1>
        <p className="help-list-lead">{cat.description}</p>
      </header>

      <div className="help-list-grid">
        {articles.map((a) => (
          <Link key={a.slug} href={`/ayuda/a/${a.slug}`} className="help-list-card card">
            <div className="help-list-card-title">{a.title}</div>
            <div className="help-list-card-desc">{a.description}</div>
            <div className="help-list-card-meta">{loc === 'en' ? 'Read →' : 'Leer →'}</div>
          </Link>
        ))}
      </div>
    </HelpShell>
  );
}
