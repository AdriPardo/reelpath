'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { HelpCategorySlug } from '@/lib/help/help-content';

type Crumb = { href: string; label: string };

type SidebarCategory = {
  slug: HelpCategorySlug;
  title: string;
  icon: string;
  href: string;
  articleCount: number;
};

type SidebarFeatured = { href: string; title: string };

const SIDEBAR_KEY = 'help-sidebar-collapsed';

export function HelpShellClient({
  children,
  breadcrumb,
  currentNav,
  rightPane,
  categories,
  featured,
}: {
  children: ReactNode;
  breadcrumb: Crumb[];
  currentNav:
    | { type: 'home' }
    | { type: 'category'; slug: HelpCategorySlug }
    | { type: 'article'; slug: string; categorySlug: HelpCategorySlug };
  rightPane: ReactNode | null;
  categories: SidebarCategory[];
  featured: SidebarFeatured[];
}) {
  const t = useTranslations('help');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const shellClass = useMemo(() => {
    const parts = ['help-shell-grid'];
    if (sidebarCollapsed) parts.push('help-shell-grid-sidebar-collapsed');
    if (!rightPane) parts.push('help-shell-grid-no-toc');
    return parts.join(' ');
  }, [sidebarCollapsed, rightPane]);

  return (
    <div className="help-shell">
      <nav className="help-breadcrumbs" aria-label={t('breadcrumb')}>
        <ol>
          {breadcrumb.map((c, idx) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="help-breadcrumb-link"
                aria-current={idx === breadcrumb.length - 1 ? 'page' : undefined}
              >
                {c.label}
              </Link>
              {idx < breadcrumb.length - 1 && <span className="help-breadcrumb-sep">/</span>}
            </li>
          ))}
        </ol>
      </nav>

      <div className={shellClass}>
        <aside
          className={`help-sidebar${sidebarCollapsed ? ' help-sidebar-collapsed' : ''}`}
          aria-label={t('shellNav')}
        >
          <div className="help-sidebar-top">
            <Link href="/ayuda" className="help-sidebar-home">
              {sidebarCollapsed ? t('sidebarHelpShort') : t('homeTitle')}
            </Link>
            <button
              type="button"
              className="help-sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? t('showMenu') : t('hideMenu')}
              aria-expanded={!sidebarCollapsed}
            >
              {sidebarCollapsed ? '»' : '«'}
            </button>
          </div>

          {!sidebarCollapsed && (
            <>
              <div className="help-sidebar-section">
                <div className="help-sidebar-section-title">{t('categories')}</div>
                <ul className="help-sidebar-list">
                  {categories.map((c) => {
                    const active =
                      (currentNav.type === 'category' && currentNav.slug === c.slug) ||
                      (currentNav.type === 'article' && currentNav.categorySlug === c.slug);
                    return (
                      <li key={c.slug}>
                        <Link
                          href={c.href}
                          className={`help-sidebar-link${active ? ' help-sidebar-link-active' : ''}`}
                        >
                          <span className="help-sidebar-link-icon" aria-hidden="true">
                            {c.icon}
                          </span>
                          <span className="help-sidebar-link-label">{c.title}</span>
                          <span className="help-sidebar-link-count" aria-label={t('sidebarArticlesAria', { count: c.articleCount })}>
                            {c.articleCount}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="help-sidebar-section">
                <div className="help-sidebar-section-title">{t('sidebarFeatured')}</div>
                <ul className="help-sidebar-list">
                  {featured.map((a) => (
                    <li key={a.href}>
                      <Link href={a.href} className="help-sidebar-subtle-link">
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </aside>

        <main className="help-content">{children}</main>

        {rightPane && <aside className="help-right">{rightPane}</aside>}
      </div>
    </div>
  );
}
