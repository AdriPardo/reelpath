'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Channel, PipelineRun } from '@/lib/api';
import { api } from '@/lib/api';
import {
  getIntegrationUiState,
  INTEGRATION_SERVICE_NAMES,
  type IntegrationProvider,
} from '@/lib/integration-labels';
import { fetchApiMockMode, triggerPipeline } from '@/lib/trigger-pipeline';
import { type ChannelCardStats, formatLastGeneration } from '@/lib/channel-stats';
import { SERVICE_UNAVAILABLE } from '@/lib/user-messages';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { isPipelineInProgress } from '@/lib/pipeline-status';
import { DeleteChannelModal } from '@/components/ChannelDeleteButton';
import type { AppLocale } from '@/i18n/routing';

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}

function IntegrationPill({
  provider,
  channel,
}: {
  provider: IntegrationProvider;
  channel: Channel;
}) {
  const t = useTranslations('channels');
  const status = channel.integrations?.[provider];
  const state = getIntegrationUiState(
    status ?? { connected: false, tokenOk: false, source: 'none' },
  );
  const shortLabel =
    state === 'connected'
      ? 'YouTube'
      : state === 'needs_attention'
        ? t('integrationReview')
        : t('notConnected');
  const variant =
    state === 'connected' ? 'success' : state === 'needs_attention' ? 'warning' : 'neutral';

  return (
    <Chip
      variant={variant}
      size="sm"
      className="channel-card-pill"
      title={INTEGRATION_SERVICE_NAMES[provider]}
      icon={<IntegrationMiniIcon />}
    >
      {shortLabel}
    </Chip>
  );
}

function IntegrationMiniIcon() {
  return (
    <span className="integration-icon-youtube" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
      </svg>
    </span>
  );
}

function ChannelCardMenu({
  channelName,
  canGenerate,
  onGenerate,
  onDelete,
}: {
  channelName: string;
  canGenerate: boolean;
  onGenerate: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('channels.card');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="channel-card-menu" ref={menuRef}>
      <button
        type="button"
        className="channel-card-menu-trigger"
        aria-label={t('optionsAria', { name: channelName })}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="channel-card-menu-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="channel-card-menu-item"
            disabled={!canGenerate}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              onGenerate();
            }}
          >
            {tc('generateVideo')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="channel-card-menu-item channel-card-menu-item-danger"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              onDelete();
            }}
          >
            {t('deleteMenu')}
          </button>
        </div>
      )}
    </div>
  );
}

export function ChannelCard({
  channel,
  stats,
}: {
  channel: Channel;
  stats?: ChannelCardStats;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations('channels');
  const tc = useTranslations('channels.card');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!channel.isActive) {
      toast(t('inactiveToast'), 'info');
      return;
    }

    setGenerating(true);
    try {
      const pipelines = await api<PipelineRun[]>(`/api/pipelines?channelId=${channel.id}`);
      const active = pipelines.filter((p) => isPipelineInProgress(p.status));
      if (active.length > 0) {
        const proceed = window.confirm(
          active.length === 1
            ? tc('confirmActiveOne', { name: channel.name })
            : tc('confirmActiveMany', { count: active.length, name: channel.name }),
        );
        if (!proceed) return;
      }

      const mockMode = await fetchApiMockMode();
      if (mockMode === false) {
        toast(tc('openaiCost'), 'info');
      }

      const result = await triggerPipeline({ channelId: channel.id });
      toast(tc('pipelineStartedProgress', { name: channel.name }), 'success');
      router.push(`/pipelines/${result.pipelineRun.id}`);
    } catch (err) {
      const message =
        err instanceof Error && err.message !== 'offline' ? err.message : SERVICE_UNAVAILABLE;
      toast(message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api<{ success: boolean }>(`/api/channels/${channel.id}`, { method: 'DELETE' });
      toast(tc('deleted'), 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('deleteError'), 'error');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    <>
      <article className="card channel-card">
        <div className="channel-card-header-row">
          <Link href={`/channels/${channel.id}`} className="channel-card-link" aria-label={tc('openAria', { name: channel.name })}>
            <div className="channel-card-heading">
              <h3 className="channel-card-name">{channel.name}</h3>
              <p className="channel-card-niche">{channel.niche}</p>
            </div>
          </Link>
          <div className="channel-card-top-meta">
            <IntegrationPill provider="youtube" channel={channel} />
            <ChannelCardMenu
              channelName={channel.name}
              canGenerate={channel.isActive && !generating}
              onGenerate={() => void handleGenerate()}
              onDelete={() => setDeleteOpen(true)}
            />
          </div>
        </div>

        {stats && (
          <div className="channel-card-stats" aria-label={tc('summaryAria')}>
            <div className="channel-card-stat">
              <span className="channel-card-stat-value">
                {stats.pendingReview > 0
                  ? tc('inReview', { count: stats.pendingReview })
                  : t('reviewUpToDate')}
              </span>
            </div>
            <div className="channel-card-stat">
              <span className="channel-card-stat-label">{tc('lastGenLabel')}</span>
              <span className="channel-card-stat-value">
                {formatLastGeneration(stats.lastGenerationAt, locale)}
              </span>
            </div>
            {stats.activeGenerations > 0 && (
              <div className="channel-card-stat">
                <span className="channel-card-stat-value channel-card-stat-active">
                  {stats.activeGenerations === 1
                    ? tc('activeCount', { count: stats.activeGenerations })
                    : tc('activeCountPlural', { count: stats.activeGenerations })}
                </span>
              </div>
            )}
          </div>
        )}

        <footer className="channel-card-footer">
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="channel-card-generate-btn"
            data-testid={`channel-generate-${channel.id}`}
            disabled={!channel.isActive || generating}
            title={channel.isActive ? tc('generateTitle') : tc('activateToGenerate')}
            onClick={() => void handleGenerate()}
          >
            <PlayIcon />
            {generating ? t('starting') : tCommon('generateVideo')}
          </Button>
          <div className="channel-card-secondary-links">
            <Link href={`/channels/${channel.id}`} className="channel-card-secondary-link">
              {tc('configure')}
            </Link>
            <Link href={`/channels/${channel.id}?tab=integraciones`} className="channel-card-secondary-link">
              {tc('accounts')}
            </Link>
            {!channel.isActive && (
              <span className="channel-card-secondary-link" style={{ opacity: 0.6 }}>
                {tc('inactive')}
              </span>
            )}
          </div>
        </footer>
      </article>

      {deleteOpen && (
        <DeleteChannelModal
          channelName={channel.name}
          loading={deleting}
          onClose={() => !deleting && setDeleteOpen(false)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}

/** @deprecated Usar ChannelCard; se mantiene por compatibilidad en otros sitios. */
export function ChannelIntegrationBadges({
  integrations,
}: {
  integrations?: Channel['integrations'];
}) {
  const stub: Channel = {
    id: '',
    name: '',
    slug: '',
    niche: '',
    isActive: true,
    integrations,
  };

  return (
    <div className="channel-card-integrations">
      <IntegrationPill provider="youtube" channel={stub} />
    </div>
  );
}
