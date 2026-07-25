/** URLs canónicas de documentos legales. */
export const LEGAL_URLS = {
  privacy: '/privacy-policy',
  terms: '/terms-of-service',
} as const;

/**
 * Identidad visual Reelpath: zinc monocromo + acento esmeralda #34d399 (flujo/pipeline).
 * Geist Sans. Wordmark tipográfico «Reel» + «path» en acento; monograma R.
 */
/** Dominio sugerido para la marca (verificado vía WHOIS nic.io, jul 2026). */
export const PLATFORM_DOMAIN = 'reelpath.io';

/** Marca de la plataforma SaaS — login, registro, nav y metadata principal. */
export const PLATFORM = {
  name: 'Reelpath',
  domain: PLATFORM_DOMAIN,
  eyebrow: 'Producción para YouTube',
  tagline: 'La ruta de tu reel — del guion al vídeo publicado en YouTube.',
  loginSubtitle: 'Accede a tu espacio de producción',
  registerSubtitle:
    'Regístrate en Reelpath. Configura tus canales después desde el panel.',
  contactEmail: 'adripardo72@gmail.com',
  features: [
    'Pipeline de guion a vídeo publicado',
    'Voz, imágenes y montaje listos para revisar',
    'Publicación en YouTube: largos y Shorts verticales',
  ],
} as const;

/** Nombre mostrado de la organización (compat. con datos legacy del seed). */
export function organizationDisplayName(name: string, slug: string): string {
  if (
    slug === 'autotube-demo' &&
    (name === 'AutoTube Demo' || name === 'Sekua Demo' || name === 'Reelpath Demo')
  ) {
    return 'Reelpath Demo';
  }
  return name;
}

/** Canal/organización de ejemplo — landing pública y sitio del creador (no login). */
export const DEMO_CHANNEL = {
  name: 'Saberes del Pasado',
  eyebrow: 'Canal educativo',
  tagline: 'Curiosidades de historia que no te enseñaron — en YouTube',
  description:
    'Herramienta privada de creación de contenido: genera guiones educativos, voz, imágenes y vídeos, y los publica en las cuentas del creador en YouTube (vídeos largos y Shorts verticales).',
  contactEmail: 'adripardo72@gmail.com',
  youtubeUrl: 'https://www.youtube.com/@SaberesdelPasado',
  publicSiteUrl: '/landing',
  features: [
    'Guiones educativos de historia generados con IA',
    'Voz, imágenes y vídeo listos para revisión',
    'Publicación en YouTube: vídeos largos y Shorts verticales',
  ],
} as const;
