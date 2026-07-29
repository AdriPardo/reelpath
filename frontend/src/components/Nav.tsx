'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { BrandMark } from '@/components/BrandMark';
import { ChannelSwitcher } from '@/components/ChannelSwitcher';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuth } from '@/context/AuthContext';
import { api, listTotal, type PaginatedResponse } from '@/lib/api';
import { isAuthRequired } from '@/lib/auth';
import { stripLocalePrefix } from '@/lib/public-paths';
import { organizationDisplayName } from '@/lib/site-brand';

type NavIcon = (props: { className?: string }) => ReactElement;

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  );
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 12l2 2 4-4" />
      <rect x="3" y="3" width="18" height="18" rx="3" />
    </svg>
  );
}

function IconVideo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="15" height="14" rx="2" />
      <path d="M17 9.5l5-3v11l-5-3" />
    </svg>
  );
}

function IconChannels({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="3" y="13" width="7" height="7" rx="1.5" />
      <rect x="14" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconHelp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 4.75 1.2c0 1.5-2.25 1.75-2.25 3.3" />
      <circle cx="12" cy="16.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

type NavEntry =
  | { type: 'separator' }
  | { type: 'link'; href: string; labelKey: 'home' | 'pipelines' | 'review' | 'videos' | 'channels' | 'help' | 'settings'; icon: NavIcon; showBadge?: boolean };

const NAV_ITEMS: NavEntry[] = [
  { type: 'link', href: '/', labelKey: 'home', icon: IconHome },
  { type: 'separator' },
  { type: 'link', href: '/pipelines', labelKey: 'pipelines', icon: IconPlay },
  { type: 'link', href: '/review', labelKey: 'review', icon: IconCheck, showBadge: true },
  { type: 'link', href: '/videos', labelKey: 'videos', icon: IconVideo },
  { type: 'separator' },
  { type: 'link', href: '/channels', labelKey: 'channels', icon: IconChannels },
  { type: 'separator' },
  { type: 'link', href: '/ayuda', labelKey: 'help', icon: IconHelp },
  { type: 'link', href: '/settings', labelKey: 'settings', icon: IconSettings },
];

const AUTH_PATHS = ['/login', '/register'];
const LEGAL_PATHS = ['/privacy-policy', '/terms-of-service', '/privacy', '/terms'];

function profileInitial(name: string | null | undefined, email: string): string {
  const source = (name?.trim() || email).trim();
  return source.charAt(0).toUpperCase() || '?';
}

export function Nav() {
  const pathname = usePathname();
  const path = stripLocalePrefix(pathname ?? '');
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { session, logout, loading } = useAuth();
  const showAuth = isAuthRequired() || !!session;
  const displayName = session?.user.name?.trim() || session?.user.email || '';

  useEffect(() => {
    if (!session) {
      setPendingCount(0);
      return;
    }
    let cancelled = false;
    api<PaginatedResponse<unknown>>('/api/videos?reviewStatus=pending&page=1&limit=1')
      .then((data) => {
        if (!cancelled) setPendingCount(listTotal(data));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session, pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (AUTH_PATHS.includes(path) || LEGAL_PATHS.includes(path)) return null;
  if (path === '/' && !loading && !session) return null;

  function isActive(href: string) {
    if (href === '/') return path === '/';
    return path === href || path.startsWith(`${href}/`);
  }

  return (
    <>
      {open && (
        <button
          type="button"
          className="sidebar-backdrop sidebar-backdrop-open"
          aria-label={t('closeMenu')}
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar${open ? ' sidebar-open' : ''}`} aria-label={t('mainNav')}>
        <div className="sidebar-header">
          <Link href="/" className="sidebar-brand" onClick={() => setOpen(false)}>
            <BrandMark size="sm" />
          </Link>
          <button
            type="button"
            className="sidebar-close"
            aria-label={t('closeMenu')}
            onClick={() => setOpen(false)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item, index) => {
            if (item.type === 'separator') {
              return <div key={`sep-${index}`} className="sidebar-separator" role="separator" />;
            }

            const { href, labelKey, icon: Icon, showBadge } = item;
            const active = isActive(href);
            const badge = showBadge && pendingCount > 0 ? pendingCount : null;

            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-link${active ? ' sidebar-link-active' : ''}`}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="sidebar-link-icon" />
                <span className="sidebar-link-label">{t(labelKey)}</span>
                {badge !== null && (
                  <span
                    className="sidebar-link-badge sidebar-link-badge-attention"
                    aria-label={tc('pendingCount', { count: badge })}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {showAuth && !loading && session && (
            <>
              <div className="sidebar-user">
                <span className="sidebar-user-avatar" aria-hidden="true">
                  {profileInitial(session.user.name, session.user.email)}
                </span>
                <div className="sidebar-user-text">
                  <span className="sidebar-user-name">{displayName}</span>
                  <span className="sidebar-user-org">
                    {organizationDisplayName(session.organization.name, session.organization.slug)}
                  </span>
                </div>
              </div>
              <ChannelSwitcher onNavigate={() => setOpen(false)} />
            </>
          )}
          <div className="sidebar-footer-actions">
            <LocaleSwitcher />
            <NotificationBell />
            <ThemeToggle />
            {showAuth && !loading && session && (
              <button type="button" className="nav-logout" onClick={() => logout()} data-testid="nav-logout">
                {t('logout')}
              </button>
            )}
            {showAuth && !loading && !session && (
              <>
                <Link href="/login" className="sidebar-link sidebar-link-compact">
                  {t('login')}
                </Link>
                <Link href="/register" className="sidebar-link sidebar-link-compact">
                  {t('register')}
                </Link>
              </>
            )}
          </div>
        </div>
      </aside>

      <header className="mobile-topbar">
        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? t('closeMenu') : t('openMenu')}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>
        <Link href="/" className="mobile-topbar-brand">
          <BrandMark size="sm" />
        </Link>
        <div className="mobile-topbar-actions">
          <LocaleSwitcher />
          <NotificationBell />
        </div>
      </header>
    </>
  );
}
