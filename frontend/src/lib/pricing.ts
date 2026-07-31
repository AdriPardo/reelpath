export interface SubscriptionPlan {
  /** ID técnico alineado con la API (`starter`, `pro`, `unlimited`). */
  id: string;
  name: string;
  priceLabel: string;
  badge?: string;
  videos: string;
  channels: string;
  ctaLabel: string;
}

/** Planes de suscripción — fuente de verdad alineada con `PlanDefinition` en seed/API. */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Creator',
    priceLabel: '79 EUR/mes',
    videos: '8 / mes',
    channels: '1 canal',
    ctaLabel: 'Empezar con Creator',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '149 EUR/mes',
    badge: 'Recomendado',
    videos: '24 / mes',
    channels: 'Hasta 3',
    ctaLabel: 'Elegir Pro',
  },
  {
    id: 'unlimited',
    name: 'Studio',
    priceLabel: '399 EUR/mes',
    videos: 'Ilimitados',
    channels: 'Ilimitados',
    ctaLabel: 'Hablar con ventas',
  },
];
