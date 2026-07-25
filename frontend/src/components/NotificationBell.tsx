'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export interface AppNotification {
  id: string;
  kind: 'review_pending' | 'pipeline_failed' | 'youtube_token_expired';
  title: string;
  message: string;
  href: string;
  createdAt: string;
  severity: 'info' | 'warning' | 'error';
}

type FetchStatus = 'loading' | 'ready' | 'error';

export function NotificationBell() {
  const t = useTranslations('components.notifications');
  const tc = useTranslations('common');
  const { session } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) {
      setItems([]);
      setStatus('ready');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    api<AppNotification[]>('/api/notifications')
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, pathname]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  if (!session) return null;

  const count = status === 'ready' ? items.length : 0;

  return (
    <div className={`notification-bell${open ? ' notification-bell-open' : ''}`} ref={panelRef}>
      <button
        type="button"
        className="notification-bell-trigger"
        aria-label={count > 0 ? t('count', { count }) : t('title')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {count > 0 && <span className="notification-bell-badge">{count}</span>}
      </button>

      {open && (
        <div className="notification-bell-panel" role="dialog" aria-label={t('title')}>
          <div className="notification-bell-panel-header">
            <strong>{t('title')}</strong>
          </div>

          {status === 'loading' && (
            <p className="notification-bell-status text-muted">{tc('loading')}</p>
          )}

          {status === 'error' && (
            <p className="notification-bell-status notification-bell-error" role="alert">
              {t('loadError')}
            </p>
          )}

          {status === 'ready' && items.length === 0 && (
            <p className="notification-bell-status notification-bell-empty text-muted">{t('empty')}</p>
          )}

          {status === 'ready' && items.length > 0 && (
            <ul className="notification-bell-list">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={`notification-bell-item notification-bell-item-${item.severity}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="notification-bell-item-title">{item.title}</span>
                    <span className="notification-bell-item-message">{item.message}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
