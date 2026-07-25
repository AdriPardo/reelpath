import fs from 'node:fs';
import path from 'node:path';
import { articleLeadFromMarkdown } from './markdown-utils';
import { translate, type AppLocale } from '@/lib/i18n';

export type HelpCategorySlug =
  | 'empezar'
  | 'youtube'
  | 'generacion'
  | 'publicacion'
  | 'analiticas'
  | 'planes'
  | 'equipo'
  | 'troubleshooting';

export interface HelpArticleMeta {
  slug: string;
  title: string;
  description: string;
  category: HelpCategorySlug;
  categoryTitle: string;
  sourcePath: string;
}

const CATEGORY_SLUGS: HelpCategorySlug[] = [
  'empezar',
  'youtube',
  'generacion',
  'publicacion',
  'analiticas',
  'planes',
  'equipo',
  'troubleshooting',
];

const SLUG_TO_CATEGORY: Record<string, HelpCategorySlug> = {
  empezar: 'empezar',
  youtube: 'youtube',
  'generar-video': 'generacion',
  publicar: 'publicacion',
  analiticas: 'analiticas',
  planes: 'planes',
  problemas: 'troubleshooting',
  equipo: 'equipo',
};

function docsRoot(locale: AppLocale) {
  const folder = locale === 'en' ? 'AYUDA-en' : 'AYUDA';
  return path.resolve(process.cwd(), '..', 'docs', folder);
}

function readFileSafe(filePath: string) {
  return fs.readFileSync(filePath, 'utf8');
}

function firstHeading(markdown: string): string | null {
  const match = markdown.match(/^\s*#\s+(.+)\s*$/m);
  return match?.[1]?.trim() ?? null;
}

function helpArticleHref(slug: string) {
  return `/ayuda/a/${slug}`;
}

const cache = new Map<string, ReturnType<typeof buildHelpHome>>();

function buildHelpHome(locale: AppLocale) {
  const root = docsRoot(locale);
  const ayudaDir = path.join(root);
  const articles: HelpArticleMeta[] = [];

  if (!fs.existsSync(ayudaDir)) {
    return {
      categories: [],
      featured: [],
      quickActions: [],
      articles: [],
    };
  }

  const quickFiles = fs
    .readdirSync(ayudaDir)
    .filter((f) => f.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, locale === 'en' ? 'en' : 'es'));

  for (const filename of quickFiles) {
    const sourcePath = path.join(ayudaDir, filename);
    const raw = readFileSafe(sourcePath);

    const title = firstHeading(raw) ?? filename.replace(/^\d+-/, '').replace(/\.md$/, '');
    const description = articleLeadFromMarkdown(raw);
    const slug = filename.replace(/^\d+-/, '').replace(/\.md$/, '');

    const category = SLUG_TO_CATEGORY[slug] ?? 'empezar';
    const categoryTitle = translate(locale, `help.category.${category}`);

    articles.push({
      slug,
      title,
      description: description || translate(locale, 'help.defaultDescription'),
      category,
      categoryTitle,
      sourcePath,
    });
  }

  const quickActions = [
    {
      href: helpArticleHref('youtube'),
      title: translate(locale, 'help.quick.connectYoutube'),
      description: translate(locale, 'help.quick.connectYoutubeDesc'),
    },
    {
      href: helpArticleHref('publicar'),
      title: translate(locale, 'help.quick.publish'),
      description: translate(locale, 'help.quick.publishDesc'),
    },
    {
      href: helpArticleHref('analiticas'),
      title: translate(locale, 'help.quick.analytics'),
      description: translate(locale, 'help.quick.analyticsDesc'),
    },
    {
      href: helpArticleHref('planes'),
      title: translate(locale, 'help.quick.plans'),
      description: translate(locale, 'help.quick.plansDesc'),
    },
  ];

  const featured = articles.slice(0, 6).map((a) => ({
    href: helpArticleHref(a.slug),
    title: a.title,
    description: a.description,
    categoryTitle: a.categoryTitle,
  }));

  const categories = CATEGORY_SLUGS.map((slug) => ({
    slug,
    title: translate(locale, `help.category.${slug}`),
    description: translate(locale, `help.categoryDesc.${slug}`),
    icon: ['▶︎', '◆', '✦', '⤴︎', '▦', '€', '⎈', '⚙︎'][CATEGORY_SLUGS.indexOf(slug)] ?? '•',
    href: `/ayuda/c/${slug}`,
    articleCount: articles.filter((a) => a.category === slug).length,
  }));

  return { categories, featured, quickActions, articles };
}

export function getHelpHome(locale: AppLocale = 'es') {
  const cached = cache.get(locale);
  if (cached) return cached;
  const data = buildHelpHome(locale);
  cache.set(locale, data);
  return data;
}

export function getAllHelpArticles(locale: AppLocale = 'es'): HelpArticleMeta[] {
  return getHelpHome(locale).articles;
}

export function getHelpArticleBySlug(slug: string, locale: AppLocale = 'es'): HelpArticleMeta | null {
  return getAllHelpArticles(locale).find((a) => a.slug === slug) ?? null;
}
