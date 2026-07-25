'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, type Channel } from '@/lib/api';

export function ChannelSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('navExt');
  const pathname = usePathname();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api<Channel[]>('/api/channels')
      .then((data) => {
        if (!cancelled) setChannels(data);
      })
      .catch(() => {
        // silencioso
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const currentChannelId = pathname?.startsWith('/channels/')
    ? pathname.split('/')[2]
    : undefined;
  const currentChannel = currentChannelId
    ? channels.find((c) => c.id === currentChannelId)
    : undefined;

  function close() {
    setOpen(false);
    onNavigate?.();
  }

  if (channels.length === 0) return null;

  const triggerLabel = currentChannel?.name ?? t('allChannels');

  return (
    <div className="channel-switcher" ref={ref}>
      <button
        type="button"
        className={`channel-switcher-trigger${currentChannel ? ' channel-switcher-trigger-active' : ''}${open ? ' channel-switcher-trigger-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="channel-switcher-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className="channel-switcher-icon"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="7" height="7" rx="1.5" />
          <rect x="14" y="4" width="7" height="7" rx="1.5" />
          <rect x="3" y="13" width="7" height="7" rx="1.5" />
          <rect x="14" y="13" width="7" height="7" rx="1.5" />
        </svg>
        <span className="channel-switcher-label">{triggerLabel}</span>
        <svg
          className="channel-switcher-caret"
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id="channel-switcher-menu"
          className="channel-switcher-dropdown"
          role="menu"
          aria-label={t('yourChannels')}
        >
          <p className="channel-switcher-heading">{t('yourChannels')}</p>
          <div className="channel-switcher-list">
            {channels.map((ch) => {
              const isActive = ch.id === currentChannelId;
              return (
                <Link
                  key={ch.id}
                  href={`/channels/${ch.id}`}
                  role="menuitem"
                  aria-current={isActive ? 'page' : undefined}
                  className={`channel-switcher-item${isActive ? ' channel-switcher-item-active' : ''}`}
                  onClick={close}
                >
                  <span className="channel-switcher-item-body">
                    <span className="channel-switcher-item-name">{ch.name}</span>
                    {ch.niche ? (
                      <span className="channel-switcher-item-niche">{ch.niche}</span>
                    ) : null}
                  </span>
                  {isActive ? (
                    <svg
                      className="channel-switcher-item-check"
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12l5 5L19 7" />
                    </svg>
                  ) : null}
                </Link>
              );
            })}
          </div>
          <div className="channel-switcher-footer">
            <Link href="/channels" role="menuitem" className="channel-switcher-link" onClick={close}>
              {t('viewAllChannels')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
