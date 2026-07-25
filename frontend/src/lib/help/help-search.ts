import fs from 'node:fs';
import type { HelpArticleMeta } from './help-content';

type IndexedDoc = {
  href: string;
  title: string;
  categoryTitle: string;
  haystack: string; // título + headings + texto (normalizado)
  preview: string;
};

export type HelpSearchIndex = {
  docs: IndexedDoc[];
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkdown(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*?\]\([^)]+?\)/g, ' ')
    .replace(/\[[^\]]+?\]\([^)]+?\)/g, ' ')
    .replace(/^>+/gm, ' ')
    .replace(/^#{1,6}\s+/gm, ' ')
    .replace(/[*_~]/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function headingsFromMarkdown(md: string) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const headings: string[] = [];
  for (const l of lines) {
    const m = l.match(/^(#{2,4})\s+(.+)\s*$/);
    if (m) headings.push(m[2].trim());
  }
  return headings.slice(0, 40);
}

let cached: HelpSearchIndex | null = null;
let cachedKey = '';

export function getHelpSearchIndex(articles: HelpArticleMeta[]): HelpSearchIndex {
  const key = articles.map((a) => `${a.slug}:${a.sourcePath}`).join('|');
  if (cached && cachedKey === key) return cached;

  const docs: IndexedDoc[] = [];

  for (const a of articles) {
    let raw = '';
    try {
      raw = fs.readFileSync(a.sourcePath, 'utf8');
    } catch {
      continue;
    }
    const headings = headingsFromMarkdown(raw).join(' ');
    const plain = stripMarkdown(raw);
    const preview = plain.slice(0, 220);
    const haystack = normalize(`${a.title} ${headings} ${plain}`);

    docs.push({
      href: `/ayuda/a/${a.slug}`,
      title: a.title,
      categoryTitle: a.categoryTitle,
      haystack,
      preview,
    });
  }

  cached = { docs };
  cachedKey = key;
  return cached;
}

export function searchHelpIndex(index: HelpSearchIndex, q: string) {
  const nq = normalize(q);
  const terms = nq.split(' ').filter(Boolean).slice(0, 6);
  if (terms.length === 0) return [];

  const results: Array<{ href: string; title: string; snippet: string; categoryTitle: string; score: number }> = [];

  for (const d of index.docs) {
    let score = 0;
    for (const t of terms) {
      const idx = d.haystack.indexOf(t);
      if (idx === -1) {
        score -= 2;
      } else {
        score += 8;
        if (idx < 90) score += 6; // match temprano (título/headings)
      }
      if (normalize(d.title).includes(t)) score += 10;
    }
    if (score <= 0) continue;

    results.push({
      href: d.href,
      title: d.title,
      categoryTitle: d.categoryTitle,
      snippet: d.preview,
      score,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

