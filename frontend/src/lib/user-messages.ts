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
    const body = JSON.parse(trimmed) as { error?: string; message?: string };
    const raw = body.error ?? body.message;
    if (raw) {
      const key = API_ERROR_KEYS[raw];
      return key ? translate(locale, key) : raw;
    }
  } catch {
    // no JSON
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return fb;
  if (trimmed.length > 200) return fb;

  const key = API_ERROR_KEYS[trimmed];
  return key ? translate(locale, key) : trimmed;
}

export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === 'development';
}

// Compatibilidad con imports existentes
export const SERVICE_UNAVAILABLE = serviceUnavailableMessage('es');
export const GENERIC_ERROR = genericErrorMessage('es');
