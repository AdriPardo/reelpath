/** URL pública del API (navegador). En prod detrás de proxy suele ser el mismo origen. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * URL del API para fetches desde el servidor Next.js (RSC / route handlers).
 * En Docker usar INTERNAL_API_URL=http://api:4000 para evitar hairpin DNS
 * que deja /api/auth/me fallido y la home renderiza la landing (parece logout).
 */
export function getServerSideApiUrl(): string {
  return process.env.INTERNAL_API_URL || API_URL;
}
