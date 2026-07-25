import { NextResponse } from 'next/server';
import { getAllHelpArticles } from '@/lib/help/help-content';
import { getHelpSearchIndex, searchHelpIndex } from '@/lib/help/help-search';

export const runtime = 'nodejs';

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const localeParam = searchParams.get('locale');
  const locale = localeParam === 'en' ? 'en' : 'es';

  if (q.length < 2) {
    return NextResponse.json({ hits: [] });
  }

  const articles = getAllHelpArticles(locale);
  const index = getHelpSearchIndex(articles);

  const hits = searchHelpIndex(index, q).slice(0, 12);
  return NextResponse.json({ hits });
}
