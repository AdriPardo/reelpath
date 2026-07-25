import fs from 'node:fs';
import type { HelpArticleMeta } from '@/lib/help/help-content';
import { articleBodyFromMarkdown } from '@/lib/help/markdown-utils';
import { HelpShell } from './HelpShell';
import { MarkdownArticle } from '@/components/docs/MarkdownArticle';
import { getArticleToc } from '@/lib/help/toc';
import { HelpToc } from './HelpToc';

export function HelpArticle({ article }: { article: HelpArticleMeta }) {
  const raw = fs.readFileSync(article.sourcePath, 'utf8');
  const toc = getArticleToc(raw);

  return (
    <HelpShell
      breadcrumb={[
        { href: '/ayuda', label: 'Ayuda' },
        { href: `/ayuda/c/${article.category}`, label: article.categoryTitle },
        { href: `/ayuda/a/${article.slug}`, label: article.title },
      ]}
      currentNav={{ type: 'article', slug: article.slug, categorySlug: article.category }}
      rightPane={<HelpToc toc={toc} />}
    >
      <article className="docs-article">
        <header className="docs-article-header">
          <h1 className="docs-article-title">{article.title}</h1>
          <p className="docs-article-lead">{article.description}</p>
        </header>
        <MarkdownArticle markdown={articleBodyFromMarkdown(raw)} />
      </article>
    </HelpShell>
  );
}

