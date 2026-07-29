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

/**
 * Canal de ejemplo en la landing: prueba de resultado (hecho *con* Reelpath),
 * no marca gemela del SaaS.
 */
export const DEMO_CHANNEL = {
  name: 'Saberes del Pasado',
  eyebrow: 'Hecho con Reelpath',
  tagline: 'Curiosidades de historia en YouTube',
  description:
    'Canal educativo real: guiones, voz, imágenes y publicación en YouTube producidos con Reelpath — con revisión humana antes de salir al aire.',
  contactEmail: 'adripardo72@gmail.com',
  youtubeUrl: 'https://www.youtube.com/@SaberesdelPasado',
  /** Si se define, la landing embebe este vídeo; si no, muestra el pipeline visual. */
  demoYoutubeVideoId: '' as string,
  publicSiteUrl: '/landing',
  features: [
    'Guiones educativos de historia',
    'Voz e imágenes revisadas antes de publicar',
    'Largos y Shorts en el mismo flujo',
  ],
} as const;
