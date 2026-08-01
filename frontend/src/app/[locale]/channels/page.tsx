import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ChannelCard } from '@/components/ChannelCard';
import { CreateChannelForm } from '@/components/CreateChannelForm';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { type Channel } from '@/lib/api';
import { serverApi } from '@/lib/api-server';
import { buildChannelStatsMap } from '@/lib/channel-stats';
import { parseApiError } from '@/lib/user-messages';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'channels' });
  return { title: t('title') };
}

export default async function ChannelsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'channels' });
  const tc = await getTranslations({ locale, namespace: 'common' });

  let channels: Channel[] = [];
  let loadError: string | null = null;

  try {
    channels = await serverApi<Channel[]>('/api/channels?light=1');
  } catch (err) {
    loadError = parseApiError(err instanceof Error ? err.message : String(err));
  }

  const statsByChannel = buildChannelStatsMap(channels);

  return (
    <div className="page-content">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          channels.length > 0 ? (
            <ButtonLink href="#nuevo-canal" variant="secondary" size="sm">
              {t('addChannel')}
            </ButtonLink>
          ) : undefined
        }
      />

      {loadError ? (
        <EmptyState
          variant="error"
          title={t('loadError')}
          description={loadError}
          action={
            <ButtonLink href="/channels" variant="primary">
              {tc('retry')}
            </ButtonLink>
          }
        />
      ) : channels.length === 0 ? (
        <EmptyState
          variant="channels"
          title={t('emptyTitle')}
          description={t('emptyDesc')}
          action={
            <div className="empty-state-form">
              <CreateChannelForm mode="first" />
            </div>
          }
        />
      ) : (
        <>
          <div className="channels-grid">
            {channels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} stats={statsByChannel[ch.id]} />
            ))}

            <div id="nuevo-canal" className="card create-channel-card">
              <CreateChannelForm mode="add" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
