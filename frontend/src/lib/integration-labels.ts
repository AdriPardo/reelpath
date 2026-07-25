import type { IntegrationProviderStatus, IntegrationSummary } from '@/lib/api';
import { translate, type AppLocale } from '@/lib/i18n';

export type IntegrationProvider = 'youtube';

export type IntegrationUiState = 'connected' | 'not_connected' | 'needs_attention';

export interface IntegrationDisplayStatus {
  state: IntegrationUiState;
  pillLabel: string;
  pillClass: 'connected' | 'disconnected' | 'attention';
  subtitle: string | null;
  userMessage: string | null;
  primaryCta: 'connect' | 'reconnect' | 'disconnect' | null;
  canLinkFromPlatform: boolean;
  canOAuth: boolean;
}

const ERROR_PATTERNS: { pattern: RegExp; key: string }[] = [
  {
    pattern: /refresh token is invalid|token has been expired|invalid_grant/i,
    key: 'channels.integration.errors.sessionExpired',
  },
  {
    pattern: /youtube|google/i,
    key: 'channels.integration.errors.sessionExpired',
  },
  {
    pattern: /sin credenciales|no hay credenciales|incomplete|incomplet/i,
    key: 'channels.integration.errors.notConnected',
  },
  {
    pattern: /unauthorized|401|403|forbidden/i,
    key: 'channels.integration.errors.unauthorized',
  },
];

export function mapIntegrationError(
  error: string | null | undefined,
  _provider: IntegrationProvider = 'youtube',
  locale: AppLocale = 'es',
): string | null {
  if (!error) return null;

  for (const { pattern, key } of ERROR_PATTERNS) {
    if (pattern.test(error)) {
      return translate(locale, key);
    }
  }

  return translate(locale, 'channels.integration.errors.generic');
}

export function getIntegrationUiState(
  status: IntegrationSummary | IntegrationProviderStatus,
): IntegrationUiState {
  if (status.connected && status.tokenOk) return 'connected';
  if (status.connected && !status.tokenOk) return 'needs_attention';
  return 'not_connected';
}

export function getIntegrationDisplayStatus(
  status: IntegrationProviderStatus,
  provider: IntegrationProvider = 'youtube',
  locale: AppLocale = 'es',
): IntegrationDisplayStatus {
  const state = getIntegrationUiState(status);
  const canOAuth = Boolean(status.oauthAvailable);
  const canLinkFromPlatform = false;

  if (state === 'connected') {
    return {
      state,
      pillLabel: translate(locale, 'channels.integration.connected'),
      pillClass: 'connected',
      subtitle: status.channelTitle ?? null,
      userMessage: null,
      primaryCta: status.source === 'channel' ? 'disconnect' : null,
      canLinkFromPlatform,
      canOAuth,
    };
  }

  if (state === 'needs_attention') {
    return {
      state,
      pillLabel: translate(locale, 'channels.integration.needsAttention'),
      pillClass: 'attention',
      subtitle: status.channelTitle ?? null,
      userMessage: mapIntegrationError(status.error, provider, locale),
      primaryCta: 'reconnect',
      canLinkFromPlatform,
      canOAuth,
    };
  }

  return {
    state,
    pillLabel: translate(locale, 'channels.integration.notConnected'),
    pillClass: 'disconnected',
    subtitle: null,
    userMessage: status.error ? mapIntegrationError(status.error, provider, locale) : null,
    primaryCta: 'connect',
    canLinkFromPlatform,
    canOAuth,
  };
}

export function getIntegrationBadgeLabel(
  label: string,
  integration?: IntegrationSummary,
  locale: AppLocale = 'es',
): { text: string; variant: 'on' | 'off' | 'attention' } {
  if (!integration) {
    return { text: translate(locale, 'channels.integration.without', { label }), variant: 'off' };
  }

  const state = getIntegrationUiState(integration);
  if (state === 'connected') {
    return { text: label, variant: 'on' };
  }
  if (state === 'needs_attention') {
    return { text: translate(locale, 'channels.integration.reviewSuffix', { label }), variant: 'attention' };
  }
  return { text: translate(locale, 'channels.integration.without', { label }), variant: 'off' };
}

export function youtubePrivacyLabel(value: string, locale: AppLocale = 'es'): string {
  const key = `channels.privacy.${value}`;
  const translated = translate(locale, key);
  return translated === key ? value : translated;
}

export function youtubePrivacyOptions(locale: AppLocale = 'es'): { value: string; label: string }[] {
  return ['public', 'unlisted', 'private'].map((value) => ({
    value,
    label: youtubePrivacyLabel(value, locale),
  }));
}

export const INTEGRATION_SERVICE_NAMES: Record<IntegrationProvider, string> = {
  youtube: 'YouTube',
};

export function integrationHelpText(locale: AppLocale = 'es'): string {
  return translate(locale, 'channels.integration.helpText');
}

export function integrationsIntro(locale: AppLocale = 'es'): string {
  return translate(locale, 'channels.integration.intro');
}

// Compatibilidad
export const INTEGRATION_HELP_TEXT = integrationHelpText('es');
export const INTEGRATIONS_INTRO = integrationsIntro('es');
