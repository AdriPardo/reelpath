'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { ScriptScene } from '@autotube/shared';

interface ScriptVariant {
  hook: string;
  scenes: ScriptScene[];
}

interface PipelineDetail {
  id: string;
  scripts: Array<{ selectedVariant: ScriptVariant }>;
}

export function ScriptEditorPanel({
  pipelineRunId,
  videoId,
  reviewStatus,
}: {
  pipelineRunId: string;
  videoId: string;
  reviewStatus: string;
}) {
  const t = useTranslations('review.scriptEditor');
  const [hook, setHook] = useState('');
  const [scenes, setScenes] = useState<ScriptScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const run = await api<PipelineDetail>(`/api/pipelines/${pipelineRunId}`);
      const variant = run.scripts[0]?.selectedVariant;
      if (!variant) {
        setError(t('noEditable'));
        return;
      }
      setHook(variant.hook);
      setScenes([...variant.scenes].sort((a, b) => a.index - b.index));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [pipelineRunId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (reviewStatus !== 'pending') return null;
  if (loading) return <p className="text-muted">{t('loading')}</p>;
  if (error) return <p className="text-muted">{error}</p>;
  if (scenes.length === 0) return null;

  async function saveScript(nextScenes: ScriptScene[], nextHook = hook) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api(`/api/pipelines/${pipelineRunId}/script`, {
        method: 'PATCH',
        body: JSON.stringify({
          hook: nextHook,
          scenes: nextScenes.map((s) => ({
            narration: s.narration,
            visualPrompt: s.visualPrompt,
            durationSec: s.durationSec,
          })),
        }),
      });
      setMessage(t('saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  function moveScene(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= scenes.length) return;
    const next = [...scenes];
    [next[index], next[target]] = [next[target], next[index]];
    const reindexed = next.map((s, i) => ({ ...s, index: i }));
    setScenes(reindexed);
    void saveScript(reindexed);
  }

  async function regenerateScene(index: number) {
    setRegenerating(index);
    setError(null);
    try {
      await api(`/api/videos/${videoId}/regenerate-scene/${index}`, { method: 'POST' });
      setMessage(t('regenerating', { n: index + 1 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('regenerateError'));
    } finally {
      setRegenerating(null);
    }
  }

  return (
    <div className="card script-editor-panel" style={{ marginTop: '1.5rem', padding: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>{t('title')}</h3>
      <p className="text-muted text-sm">{t('intro')}</p>

      <label className="text-sm" htmlFor="script-hook">
        {t('hook')}
      </label>
      <textarea
        id="script-hook"
        className="input"
        rows={2}
        value={hook}
        onChange={(e) => setHook(e.target.value)}
        onBlur={() => void saveScript(scenes, hook)}
        style={{ width: '100%', marginBottom: '1rem' }}
      />

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {scenes.map((scene, i) => (
          <li
            key={`scene-${i}`}
            className="card"
            style={{ marginBottom: '0.75rem', padding: '0.75rem' }}
          >
            <div className="section-title-row" style={{ marginBottom: '0.5rem' }}>
              <strong>{t('scene', { n: i + 1 })}</strong>
              <span style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={i === 0 || saving}
                  onClick={() => moveScene(i, -1)}
                  aria-label={t('moveUp')}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={i === scenes.length - 1 || saving}
                  onClick={() => moveScene(i, 1)}
                  aria-label={t('moveDown')}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={regenerating === i}
                  onClick={() => void regenerateScene(i)}
                >
                  {regenerating === i ? '…' : t('regenerate')}
                </button>
              </span>
            </div>
            <textarea
              className="input"
              rows={3}
              value={scene.narration}
              onChange={(e) => {
                const next = scenes.map((s, idx) =>
                  idx === i ? { ...s, narration: e.target.value } : s,
                );
                setScenes(next);
              }}
              onBlur={() => void saveScript(scenes, hook)}
              style={{ width: '100%' }}
            />
          </li>
        ))}
      </ul>

      {message && <p className="text-sm text-muted">{message}</p>}
      {error && (
        <p className="text-sm" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
