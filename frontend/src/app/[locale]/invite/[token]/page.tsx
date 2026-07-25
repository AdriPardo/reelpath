'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';

export default function InvitePage() {
  const t = useTranslations('auth');
  const params = useParams() as { token?: string | string[]; locale?: string } | null;
  const token = typeof params?.token === 'string' ? params.token : '';
  const { session, loading, refresh } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && session && token && !done && !accepting) {
      setAccepting(true);
      api<{ message: string }>('/api/org/invites/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
        .then(async (result) => {
          setDone(true);
          toast(result.message, 'success');
          await refresh();
          router.push('/settings?tab=team');
        })
        .catch((err) => {
          toast(err instanceof Error ? err.message : t('inviteAcceptError'), 'error');
        })
        .finally(() => setAccepting(false));
    }
  }, [loading, session, token, done, accepting, toast, refresh, router, t]);

  return (
    <>
      <PageHeader title={t('inviteTitle')} subtitle={t('inviteSubtitle')} />
      <div className="settings-section" style={{ maxWidth: 480 }}>
        {loading || accepting ? (
          <p className="text-muted">{t('inviteProcessing')}</p>
        ) : done ? (
          <p>{t('inviteAccepted')}</p>
        ) : session ? null : (
          <>
            <p className="text-muted text-sm mb-4">{t('inviteLogin')}</p>
            <div className="settings-form-actions">
              <Link href={`/login?next=/invite/${token}`}>
                <Button variant="primary" size="sm">
                  {t('inviteLoginBtn')}
                </Button>
              </Link>
              <Link href={`/register?next=/invite/${token}`}>
                <Button variant="secondary" size="sm">
                  {t('inviteRegisterBtn')}
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
