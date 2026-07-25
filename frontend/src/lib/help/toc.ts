import GithubSlugger from 'github-slugger';
import type { TocItem } from '@/components/ayuda/HelpToc';

export function getArticleToc(markdown: string): TocItem[] {
  const slugger = new GithubSlugger();
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const toc: TocItem[] = [];

  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!m) continue;
    const level = m[1].length as 2 | 3;
    const text = m[2].replace(/\s+#.*$/, '').trim();
    const id = slugger.slug(text);
    toc.push({ id, text, level });
  }

  return toc.slice(0, 60);
}

