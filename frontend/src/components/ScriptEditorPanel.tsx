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
  if (loading) return <p className="text-muted script-editor-status">{t('loading')}</p>;
  if (error) return <p className="text-muted script-editor-status">{error}</p>;
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
    <section className="script-editor-panel" aria-labelledby="script-editor-heading">
      <header className="script-editor-header">
        <h3 id="script-editor-heading">{t('title')}</h3>
        <p className="script-editor-intro">{t('intro')}</p>
      </header>

      <label className="form-label" htmlFor="script-hook">
        {t('hook')}
      </label>
      <textarea
        id="script-hook"
        className="form-input script-editor-textarea"
        rows={2}
        value={hook}
        onChange={(e) => setHook(e.target.value)}
        onBlur={() => void saveScript(scenes, hook)}
      />

      <ul className="script-scene-list">
        {scenes.map((scene, i) => (
          <li key={`scene-${i}`} className="script-scene-item">
            <div className="script-scene-toolbar">
              <strong className="script-scene-label">{t('scene', { n: i + 1 })}</strong>
              <div className="script-scene-actions">
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
              </div>
            </div>
            <textarea
              className="form-input script-editor-textarea"
              rows={3}
              value={scene.narration}
              onChange={(e) => {
                const next = scenes.map((s, idx) =>
                  idx === i ? { ...s, narration: e.target.value } : s,
                );
                setScenes(next);
              }}
              onBlur={() => void saveScript(scenes, hook)}
            />
          </li>
        ))}
      </ul>

      {message && <p className="script-editor-feedback text-muted">{message}</p>}
      {error && (
        <p className="script-editor-feedback script-editor-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
