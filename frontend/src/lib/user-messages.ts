import { translate, type AppLocale } from '@/lib/i18n';

/** Mensajes y utilidades de copy orientado al usuario final. */

export function serviceUnavailableMessage(locale: AppLocale = 'es'): string {
  return translate(locale, 'api.serviceUnavailable');
}

export function genericErrorMessage(locale: AppLocale = 'es'): string {
  return translate(locale, 'api.genericError');
}

const API_ERROR_KEYS: Record<string, string> = {
  'Channel not found': 'api.errors.channelNotFound',
  'Video not found': 'api.errors.videoNotFound',
  'Vídeo no encontrado': 'api.errors.videoNotFound',
  'Pipeline run not found': 'api.errors.pipelineNotFound',
  'Clip not found': 'api.errors.clipNotFound',
  'No tienes acceso a este vídeo': 'api.errors.noVideoAccess',
  Unauthorized: 'api.errors.sessionExpired',
  'Invalid credentials': 'api.errors.invalidCredentials',
  'Registro deshabilitado': 'api.errors.registrationDisabledShort',
  'El canal está inactivo': 'api.errors.channelInactive',
  'Solo se pueden reintentar pipelines fallidos': 'api.errors.retryFailedOnly',
};

/** Códigos de PlanLimitError / API → clave i18n (cuando `error` viene truncado o es un locale). */
const API_ERROR_CODES: Record<string, string> = {
  TRIAL_EXPIRED: 'api.errors.trialExpired',
  ORG_INACTIVE: 'api.errors.orgInactive',
  ORG_NOT_FOUND: 'api.errors.orgNotFound',
  PIPELINE_DAILY_LIMIT: 'api.errors.pipelineDailyLimit',
  VIDEO_MONTHLY_LIMIT: 'api.errors.videoMonthlyLimit',
};

const YOUTUBE_SESSION_EXPIRED =
  /invalid_grant|refresh token is invalid|token has been expired|sesión con youtube ha caducado/i;

/** Título breve para errores de pipeline según el mensaje almacenado. */
export function pipelineErrorTitle(
  error: string | null | undefined,
  locale: AppLocale = 'es',
): string {
  if (error && YOUTUBE_SESSION_EXPIRED.test(error)) {
    return translate(locale, 'api.pipelineErrors.youtubeDisconnected');
  }
  return translate(locale, 'api.pipelineErrors.somethingWrong');
}

/** Mensaje legible para errores de pipeline (p. ej. publicación tras aprobar). */
export function mapPipelineError(
  error: string | null | undefined,
  locale: AppLocale = 'es',
): string {
  if (!error) return genericErrorMessage(locale);
  if (YOUTUBE_SESSION_EXPIRED.test(error)) {
    return translate(locale, 'api.pipelineErrors.sessionExpired');
  }
  if (/ya se está ejecutando/i.test(error)) {
    return translate(locale, 'api.pipelineErrors.uploadConflict');
  }
  if (/no está conectado para este canal|conecta youtube/i.test(error)) {
    return translate(locale, 'api.pipelineErrors.notConnected');
  }
  if (/No se pudo generar un teaser|teaser válido/i.test(error)) {
    return translate(locale, 'api.pipelineErrors.teaserFailed');
  }
  return error;
}

function looksLikeLocaleCode(value: string): boolean {
  return value === 'es' || value === 'en' || /^[a-z]{2}(-[A-Z]{2})?$/.test(value);
}

/** Extrae un mensaje legible de respuestas de error (JSON o texto plano). */
export function parseApiError(
  text: string,
  fallback?: string,
  locale: AppLocale = 'es',
): string {
  const fb = fallback ?? genericErrorMessage(locale);
  const trimmed = text.trim();
  if (!trimmed) return fb;

  try {
    const body = JSON.parse(trimmed) as {
      error?: string;
      message?: string;
      code?: string;
      limit?: number;
    };
    const codeKey = body.code ? API_ERROR_CODES[body.code] : undefined;
    const raw = body.error ?? body.message;

    // Preferir código de negocio si el mensaje es basura (p. ej. locale "es" por i18n invertido).
    if (codeKey && (!raw || looksLikeLocaleCode(raw))) {
      const params =
        typeof body.limit === 'number' ? { limit: body.limit } : undefined;
      return translate(locale, codeKey, params);
    }

    if (raw) {
      const key = API_ERROR_KEYS[raw];
      return key ? translate(locale, key) : raw;
    }

    if (codeKey) return translate(locale, codeKey);
  } catch {
    // no JSON
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return fb;
  if (trimmed.length > 200) return fb;
  if (looksLikeLocaleCode(trimmed)) return fb;

  const key = API_ERROR_KEYS[trimmed];
  return key ? translate(locale, key) : trimmed;
}

export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === 'development';
}

// Compatibilidad con imports existentes
export const SERVICE_UNAVAILABLE = serviceUnavailableMessage('es');
export const GENERIC_ERROR = genericErrorMessage('es');
