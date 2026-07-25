export interface SubscriptionPlan {
  /** ID técnico alineado con la API (`starter`, `pro`, `unlimited`). */
  id: string;
  name: string;
  priceLabel: string;
  badge?: string;
  description: string;
  bullets: string[];
  ctaLabel: string;
}

/** Planes de suscripción — fuente de verdad alineada con `PlanDefinition` en seed/API. */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Creator',
    priceLabel: '79 EUR/mes',
    description: 'Para creadores que publican con ritmo (~2 vídeos largos por semana) y quieren automatizar el canal.',
    bullets: [
      'Hasta 8 vídeos al mes',
      '1 canal y revisión manual antes de publicar',
      'Hasta 2 generaciones al día',
    ],
    ctaLabel: 'Empezar con Creator',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '149 EUR/mes',
    badge: 'Lanzamiento',
    description: 'El plan de referencia para operar un canal en serio sin montar un equipo interno completo.',
    bullets: [
      'Hasta 16 vídeos al mes',
      'Hasta 3 canales',
      'Hasta 4 generaciones al día',
    ],
    ctaLabel: 'Elegir Pro',
  },
  {
    id: 'unlimited',
    name: 'Studio',
    priceLabel: '399 EUR/mes',
    description: 'Para agencias, estudios y operadores multi-canal que necesitan volumen y margen de maniobra.',
    bullets: [
      'Canales y vídeos ilimitados',
      'Flujos de publicación y revisión para equipo',
      'Onboarding y acompañamiento de lanzamiento',
    ],
    ctaLabel: 'Hablar con ventas',
  },
];
