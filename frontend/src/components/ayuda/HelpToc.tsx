'use client';

import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useTranslations } from 'next-intl';

export type TocItem = { id: string; text: string; level: 2 | 3 };

const TOC_KEY = 'help-toc-collapsed';

function scrollToHeading(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(null, '', `#${id}`);
  return true;
}

function useActiveHeading(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) return;

    const els = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop);
        if (visible[0]) setActive((visible[0].target as HTMLElement).id);
      },
      { rootMargin: '-88px 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] },
    );

    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids.join('|')]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash || !ids.includes(hash)) return;
    window.requestAnimationFrame(() => scrollToHeading(hash));
  }, [ids.join('|')]);

  return active;
}

export function HelpToc({ toc }: { toc: TocItem[] }) {
  const t = useTranslations('help');
  const ids = useMemo(() => toc.map((item) => item.id), [toc]);
  const active = useActiveHeading(ids);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(TOC_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  function toggleToc() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(TOC_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (toc.length === 0) return null;

  function onTocClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    scrollToHeading(id);
  }

  return (
    <div className={`help-toc${collapsed ? ' help-toc-collapsed' : ''}`}>
      <div className="help-toc-header">
        <div className="help-toc-title">{t('tocTitle')}</div>
        <button
          type="button"
          className="help-toc-toggle"
          onClick={toggleToc}
          aria-label={collapsed ? t('expandToc') : t('collapseToc')}
          aria-expanded={!collapsed}
        >
          {collapsed ? '+' : '−'}
        </button>
      </div>
      {!collapsed && (
        <ul className="help-toc-list">
          {toc.map((t) => (
            <li
              key={t.id}
              className={`help-toc-item help-toc-item-l${t.level}${active === t.id ? ' help-toc-item-active' : ''}`}
            >
              <a href={`#${t.id}`} onClick={(e) => onTocClick(e, t.id)}>
                {t.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
