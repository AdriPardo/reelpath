'use client';

import { useEffect, useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ChannelIntegrationsResponse } from '@/lib/api';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import {
  getIntegrationDisplayStatus,
  integrationHelpText,
  INTEGRATION_SERVICE_NAMES,
  youtubePrivacyOptions,
} from '@/lib/integration-labels';
import type { AppLocale } from '@/i18n/routing';

const isDev = process.env.NODE_ENV === 'development';

function integrationChipVariant(
  pillClass: 'connected' | 'disconnected' | 'attention',
): 'neutral' | 'success' | 'warning' {
  if (pillClass === 'connected') return 'success';
  if (pillClass === 'attention') return 'warning';
  return 'neutral';
}

function YouTubeIcon() {
  return (
    <span className="integration-icon integration-icon-youtube" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
      </svg>
    </span>
  );
}

function DisconnectModal({
  onClose,
  onConfirm,
  loading,
}: {
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const t = useTranslations('channels.integrations');
  const tc = useTranslations('common');

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="disconnect-modal-title"
      >
        <h3 id="disconnect-modal-title">{t('disconnectTitle')}</h3>
        <p className="modal-subtitle">{t('disconnectSubtitle')}</p>
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {tc('cancel')}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? t('disconnecting') : t('disconnect')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConnectModal({
  onClose,
  onConfirm,
  loading,
}: {
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const t = useTranslations('channels.integrations');
  const tc = useTranslations('common');

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-modal-title"
      >
        <h3 id="connect-modal-title">{t('connectTitle')}</h3>
        <p className="modal-subtitle">{t('connectSubtitle')}</p>
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {tc('cancel')}
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm} disabled={loading}>
            {loading ? t('connecting') : t('continueGoogle')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function UnavailableModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('channels.integrations');

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unavailable-modal-title"
      >
        <h3 id="unavailable-modal-title">{t('unavailableTitle')}</h3>
        <p className="modal-subtitle">{t('unavailableSubtitle')}</p>
        <div className="modal-actions">
          <Button type="button" variant="primary" onClick={onClose}>
            {t('understood')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function IntegrationCard({
  channelId,
  status,
  locale,
}: {
  channelId: string;
  status: ChannelIntegrationsResponse['youtube'] | undefined;
  locale: AppLocale;
}) {
  const t = useTranslations('channels.integrations');
  const tch = useTranslations('channels');
  const safeStatus: ChannelIntegrationsResponse['youtube'] = status ?? {
    provider: 'youtube',
    connected: false,
    tokenOk: false,
    source: 'none',
    error: null,
  };

  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [privacy, setPrivacy] = useState(safeStatus.privacyStatus ?? 'private');

  const clientIdId = useId();
  const clientSecretId = useId();
  const refreshTokenId = useId();

  const [manual, setManual] = useState({
    clientId: '',
    clientSecret: '',
    refreshToken: '',
  });

  const display = getIntegrationDisplayStatus(safeStatus, 'youtube', locale);
  const serviceName = INTEGRATION_SERVICE_NAMES.youtube;
  const privacyEditable = safeStatus.source === 'channel' && display.state !== 'not_connected';

  async function patch(body: Record<string, unknown>, successMessage?: string) {
    setLoading(true);
    try {
      await api<ChannelIntegrationsResponse>(
        `/api/channels/${channelId}/integrations/youtube`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      toast(successMessage ?? t('changesSaved'), 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('actionError'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function connectYouTubeOAuth() {
    setLoading(true);
    try {
      const { url } = await api<{ url: string }>(
        `/api/channels/${channelId}/integrations/youtube/connect`,
      );
      window.location.href = url;
    } catch (err) {
      toast(err instanceof Error ? err.message : t('connectError'), 'error');
      setLoading(false);
      setShowConnectModal(false);
    }
  }

  async function disconnect() {
    await patch({ action: 'disconnect' }, t('disconnected'));
  }

  async function savePrivacy() {
    await patch({ action: 'update', privacyStatus: privacy }, t('privacySaved'));
  }

  async function connectManual(e: React.FormEvent) {
    e.preventDefault();
    await patch(
      {
        action: 'connect',
        credentials: {
          clientId: manual.clientId,
          clientSecret: manual.clientSecret,
          refreshToken: manual.refreshToken,
        },
        privacyStatus: privacy,
      },
      t('linkedSuccess'),
    );
  }

  function handlePrimaryAction() {
    if (display.primaryCta === 'disconnect') {
      setShowDisconnectModal(true);
      return;
    }
    if (display.canOAuth) {
      setShowConnectModal(true);
    } else {
      setShowUnavailableModal(true);
    }
  }

  const primaryLabel =
    display.primaryCta === 'disconnect'
      ? t('disconnect')
      : display.primaryCta === 'reconnect'
        ? t('reconnect', { service: serviceName })
        : t('connect', { service: serviceName });

  const primaryVariant = display.primaryCta === 'disconnect' ? 'ghost' : 'primary';

  return (
    <>
      <article className="card integration-card">
        <header className="integration-card-header">
          <YouTubeIcon />
          <div className="integration-card-heading">
            <h3>{serviceName}</h3>
            {display.subtitle && <p className="integration-account-name">{display.subtitle}</p>}
          </div>
          <Chip
            variant={integrationChipVariant(display.pillClass)}
            className="integration-status"
          >
            {display.pillLabel}
          </Chip>
        </header>

        {display.userMessage && (
          <p className="integration-message" role="status">
            {display.userMessage}
          </p>
        )}

        {display.primaryCta && (
          <div className="integration-cta">
            <Button
              type="button"
              variant={primaryVariant}
              size="sm"
              disabled={loading}
              onClick={handlePrimaryAction}
            >
              {loading ? t('processing') : primaryLabel}
            </Button>
          </div>
        )}

        <div className="integration-privacy">
          <label className="modal-field">
            <span className="integration-privacy-label field-label-row">
              <span>{tch('privacyQuestion')}</span>
              <InfoTooltip content={t('privacyTooltip')} />
            </span>
            <select
              className="topic-input"
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value)}
              disabled={display.state === 'not_connected' && safeStatus.source !== 'channel'}
            >
              {youtubePrivacyOptions(locale).map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {privacyEditable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => savePrivacy()}
            >
              {t('savePreference')}
            </Button>
          )}
        </div>

        {isDev && (
          <details className="integrations-advanced">
            <summary>{t('advancedDev')}</summary>
            <div className="integrations-advanced-body">
              <form className="channel-settings-form integration-manual-form" onSubmit={connectManual}>
                <label className="modal-field" htmlFor={clientIdId}>
                  Client ID
                  <input
                    id={clientIdId}
                    className="topic-input"
                    value={manual.clientId}
                    onChange={(e) => setManual((m) => ({ ...m, clientId: e.target.value }))}
                    required
                  />
                </label>
                <label className="modal-field" htmlFor={clientSecretId}>
                  Client Secret
                  <input
                    id={clientSecretId}
                    type="password"
                    className="topic-input"
                    value={manual.clientSecret}
                    onChange={(e) => setManual((m) => ({ ...m, clientSecret: e.target.value }))}
                    required
                  />
                </label>
                <label className="modal-field" htmlFor={refreshTokenId}>
                  Refresh Token
                  <input
                    id={refreshTokenId}
                    type="password"
                    className="topic-input"
                    value={manual.refreshToken}
                    onChange={(e) => setManual((m) => ({ ...m, refreshToken: e.target.value }))}
                    required
                  />
                </label>
                <Button type="submit" variant="secondary" size="sm" disabled={loading}>
                  {t('saveManualCreds')}
                </Button>
              </form>
            </div>
          </details>
        )}
      </article>

      {showConnectModal && (
        <ConnectModal
          loading={loading}
          onClose={() => setShowConnectModal(false)}
          onConfirm={() => void connectYouTubeOAuth()}
        />
      )}
      {showDisconnectModal && (
        <DisconnectModal
          loading={loading}
          onClose={() => !loading && setShowDisconnectModal(false)}
          onConfirm={() => {
            void disconnect().finally(() => setShowDisconnectModal(false));
          }}
        />
      )}
      {showUnavailableModal && <UnavailableModal onClose={() => setShowUnavailableModal(false)} />}
    </>
  );
}

export function ChannelIntegrationsPanel({
  channelId,
  integrations,
}: {
  channelId: string;
  integrations: ChannelIntegrationsResponse;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations('channels.integrations');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const youtubeStatus = searchParams?.get('youtube');
    if (!youtubeStatus) return;

    if (youtubeStatus === 'connected') {
      toast(t('connectedSuccess'), 'success');
    } else if (youtubeStatus === 'error') {
      const message = searchParams?.get('message');
      toast(message ? decodeURIComponent(message) : t('connectFailed'), 'error');
    }

    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('youtube');
    params.delete('message');
    const qs = params.toString();
    router.replace(qs ? `/channels/${channelId}?${qs}` : `/channels/${channelId}`, { scroll: false });
  }, [channelId, router, searchParams, toast, t]);

  return (
    <div className="integrations-grid">
      <div className="section-title-row">
        <p className="integrations-intro">{t('introShort')}</p>
        <InfoTooltip content={integrationHelpText(locale)} />
      </div>
      <IntegrationCard channelId={channelId} status={integrations?.youtube} locale={locale} />
    </div>
  );
}
