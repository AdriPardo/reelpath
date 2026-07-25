'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export function SettingsBillingNotice() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh } = useAuth();
  const billing = searchParams?.get('billing');

  useEffect(() => {
    if (billing === 'success' || billing === 'portal') {
      void refresh().then(() => {
        router.refresh();
      });
    }
  }, [billing, refresh, router]);

  if (billing === 'success') {
    return (
      <p className="settings-billing-notice" role="status">
        Pago completado. Tu plan se actualizará en breve.
      </p>
    );
  }

  if (billing === 'portal') {
    return (
      <p className="settings-billing-notice settings-billing-notice-muted" role="status">
        Has vuelto del portal de facturación de Stripe.
      </p>
    );
  }

  if (billing === 'cancel') {
    return (
      <p className="settings-billing-notice settings-billing-notice-muted" role="status">
        El pago se canceló. Tu plan no ha cambiado.
      </p>
    );
  }

  return null;
}
