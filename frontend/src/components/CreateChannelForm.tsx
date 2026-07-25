'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

export function CreateChannelForm({ mode = 'first' }: { mode?: 'first' | 'add' }) {
  const t = useTranslations('channels');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const nameId = useId();
  const nicheId = useId();
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);

  function slugify(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const channel = await api<{ id: string }>('/api/channels', {
        method: 'POST',
        body: JSON.stringify({ name, slug: slugify(name), niche }),
      });
      toast(t('createdToast'), 'success');
      router.push(`/channels/${channel.id}`);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('create.createError'), 'error');
    } finally {
      setLoading(false);
    }
  }

  const isAdd = mode === 'add';

  return (
    <form className="create-channel-form form-stack" onSubmit={submit}>
      <header className="form-panel-header">
        <div className="form-panel-icon" aria-hidden="true">
          {isAdd ? '+' : '📺'}
        </div>
        <div>
          <h3 className="form-panel-title">{isAdd ? t('newChannel') : t('setupChannel')}</h3>
          <p className="form-panel-subtitle">
            {isAdd ? t('create.subtitleAdd') : t('create.subtitleFirst')}
          </p>
        </div>
      </header>

      <div className="form-field">
        <label htmlFor={nameId}>{t('nameLabel')}</label>
        <input
          id={nameId}
          className="form-input"
          data-testid="channel-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('create.namePlaceholder')}
          required
          autoComplete="off"
        />
      </div>

      <div className="form-field">
        <label htmlFor={nicheId}>{t('nicheLabel')}</label>
        <input
          id={nicheId}
          className="form-input"
          data-testid="channel-niche"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="historia, ciencia, curiosidades…"
          required
          autoComplete="off"
        />
        <p className="form-hint">{t('create.nicheHint')}</p>
      </div>

      <Button
        type="submit"
        variant="primary"
        className="btn-block btn-lg"
        disabled={loading}
        data-testid="channel-create-submit"
      >
        {loading ? t('creating') : isAdd ? t('create.createChannel') : t('createFirst')}
      </Button>
    </form>
  );
}
