'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TriggerPipelineButton } from '@/components/TriggerPipelineButton';
import { UploadLongVideoButton } from '@/components/UploadLongVideoButton';

type CreateMode = 'generate' | 'upload';

export function ChannelCreatePanel({ channelId }: { channelId: string }) {
  const t = useTranslations('channels.createPanel');
  const [mode, setMode] = useState<CreateMode>('generate');

  return (
    <section className="channel-create-panel card" aria-labelledby="channel-create-heading">
      <header className="channel-create-header">
        <div>
          <h2 id="channel-create-heading" className="channel-create-title">
            {t('title')}
          </h2>
          <p className="channel-create-desc">{t('subtitle')}</p>
        </div>
      </header>

      <div className="filter-tabs channel-create-tabs" role="tablist" aria-label={t('modesAria')}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'generate'}
          className={`filter-tab${mode === 'generate' ? ' filter-tab-active' : ''}`}
          onClick={() => setMode('generate')}
        >
          {t('generate')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'upload'}
          className={`filter-tab${mode === 'upload' ? ' filter-tab-active' : ''}`}
          onClick={() => setMode('upload')}
        >
          {t('upload')}
        </button>
      </div>

      <div className="channel-create-body" role="tabpanel">
        {mode === 'generate' ? (
          <TriggerPipelineButton channelId={channelId} embedded />
        ) : (
          <UploadLongVideoButton channelId={channelId} embedded />
        )}
      </div>
    </section>
  );
}
