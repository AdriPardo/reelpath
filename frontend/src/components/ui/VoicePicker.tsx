'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import type { TtsVoiceOption } from '@autotube/shared';
import { apiFetch, getClientLocale } from '@/lib/api';
import { parseApiError } from '@/lib/user-messages';
import { useToast } from '@/components/ui/Toast';

export type VoicePickerOption = TtsVoiceOption & {
  previewUrl?: string | null;
};

type VoicePickerProps = {
  id?: string;
  voices: VoicePickerOption[];
  value: string;
  onChange: (voiceId: string) => void;
  inheritLabel?: string;
  provider?: 'auto' | 'edge' | 'elevenlabs' | 'openai';
  disabled?: boolean;
  className?: string;
};

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function voiceInitials(label: string): string {
  const parts = label
    .replace(/[()[\]{}]/g, ' ')
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => /^[\p{L}\p{N}]/u.test(p));
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function VoiceAvatar({ voice, size = 'md' }: { voice: VoicePickerOption | null; size?: 'sm' | 'md' }) {
  const label = voice?.label?.trim() || '?';
  const initials = voiceInitials(label);
  const hue = voice ? hashHue(voice.id) : 160;
  return (
    <span
      className={`voice-picker-avatar voice-picker-avatar-${size}`}
      style={{
        background: `linear-gradient(145deg, hsl(${hue} 42% 42%), hsl(${(hue + 40) % 360} 48% 28%))`,
      }}
      aria-hidden="true"
    >
      {initials || '·'}
    </span>
  );
}

function PlayIcon({ playing, loading }: { playing: boolean; loading?: boolean }) {
  if (loading) {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="voice-picker-spin">
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray="36 20"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return playing ? (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5L8 5.5z" fill="currentColor" />
    </svg>
  );
}

function previewLanguage(voice: VoicePickerOption): string {
  const locale = (voice.locale || '').toLowerCase();
  if (locale.startsWith('en')) return 'en';
  if (locale.startsWith('es')) return 'es';
  return getClientLocale() === 'en' ? 'en' : 'es';
}

export function VoicePicker({
  id,
  voices,
  value,
  onChange,
  inheritLabel,
  provider = 'elevenlabs',
  disabled,
  className,
}: VoicePickerProps) {
  const t = useTranslations('voicePicker');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const autoId = useId();
  const listboxId = `${autoId}-listbox`;
  const searchId = `${autoId}-search`;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [enriched, setEnriched] = useState<VoicePickerOption[]>(voices);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setEnriched(voices);
  }, [voices]);

  useEffect(() => {
    if (provider !== 'elevenlabs') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/org/tts/voices?provider=elevenlabs`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { voices?: VoicePickerOption[] };
        if (!data.voices?.length || cancelled) return;
        const byId = new Map(data.voices.map((v) => [v.id, v]));
        setEnriched(
          voices.map((v) => {
            const remote = byId.get(v.id);
            return remote ? { ...v, ...remote, previewUrl: remote.previewUrl ?? v.previewUrl } : v;
          }),
        );
      } catch {
        /* curated list still works without remote previews */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, voices]);

  const updatePanelPosition = useCallback(() => {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const edge = 12;
    const preferred = Math.min(440, Math.round(window.innerHeight * 0.7));
    const spaceBelow = window.innerHeight - rect.bottom - gap - edge;
    const spaceAbove = rect.top - gap - edge;
    const openUp = spaceBelow < 300 && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    // Always give the list room to scroll; never clip to ~2 rows.
    const height = Math.max(280, Math.min(preferred, Math.max(available, 280)));
    const width = Math.min(Math.max(rect.width, 320), window.innerWidth - edge * 2);
    const left = Math.max(edge, Math.min(rect.left, window.innerWidth - width - edge));

    let top: number | undefined;
    let bottom: number | undefined;
    if (openUp) {
      bottom = window.innerHeight - rect.top + gap;
      const maxTop = edge;
      const computedTop = window.innerHeight - bottom - height;
      if (computedTop < maxTop) {
        // Clamp into viewport: use top+height instead of oversized bottom.
        top = maxTop;
        bottom = undefined;
      }
    } else {
      top = rect.bottom + gap;
      if (top + height > window.innerHeight - edge) {
        top = Math.max(edge, window.innerHeight - edge - height);
      }
    }

    setPanelStyle({
      position: 'fixed',
      left,
      width,
      height,
      maxHeight: height,
      zIndex: 10050,
      ...(top != null ? { top, bottom: 'auto' } : {}),
      ...(bottom != null ? { bottom, top: 'auto' } : {}),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    // Focus search without scrolling the page behind the portal.
    const search = document.getElementById(searchId) as HTMLInputElement | null;
    search?.focus({ preventScroll: true });
    const selectedEl = listRef.current?.querySelector('.voice-picker-row.is-selected');
    selectedEl?.scrollIntoView({ block: 'nearest' });
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open, searchId, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: Event) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: Event) {
      if ((e as globalThis.KeyboardEvent).key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const stopPreview = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    revokeBlob();
    setPlayingId(null);
    setLoadingId(null);
  }, [revokeBlob]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const selected = useMemo(
    () => (value ? enriched.find((v) => v.id === value) ?? null : null),
    [enriched, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter((v) => {
      const hay = [v.label, v.accent, v.description, v.gender, v.locale, v.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [enriched, query]);

  const togglePreview = useCallback(
    async (voice: VoicePickerOption, e?: MouseEvent) => {
      e?.stopPropagation();
      e?.preventDefault();
      if (loadingId === voice.id) return;
      if (playingId === voice.id) {
        stopPreview();
        return;
      }
      stopPreview();
      setLoadingId(voice.id);

      let url = voice.previewUrl?.trim() || null;
      try {
        if (!url) {
          const resolvedProvider =
            provider === 'elevenlabs' || provider === 'openai' ? provider : 'edge';
          const res = await apiFetch('/api/org/tts/preview', {
            method: 'POST',
            body: JSON.stringify({
              provider: resolvedProvider,
              voiceId: voice.id,
              language: previewLanguage(voice),
            }),
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(parseApiError(text, undefined, getClientLocale()));
          }
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const text = await res.text();
            throw new Error(parseApiError(text, undefined, getClientLocale()));
          }
          const blob = await res.blob();
          if (!blob.size) throw new Error(t('previewEmpty'));
          url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
        }

        const audio = new Audio(url);
        audio.preload = 'auto';
        audioRef.current = audio;
        audio.onended = () => {
          setPlayingId(null);
          revokeBlob();
        };
        audio.onerror = () => {
          setPlayingId(null);
          revokeBlob();
          toast(t('previewPlayFailed'), 'error');
        };
        setPlayingId(voice.id);
        setLoadingId(null);
        await audio.play();
      } catch (err) {
        setLoadingId(null);
        setPlayingId(null);
        revokeBlob();
        toast(err instanceof Error ? err.message : tc('errorGeneric'), 'error');
      }
    },
    [loadingId, playingId, provider, revokeBlob, stopPreview, t, tc, toast],
  );

  function selectVoice(next: string) {
    onChange(next);
    setOpen(false);
    setQuery('');
    stopPreview();
  }

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  }

  const triggerLabel = selected
    ? selected.label
    : inheritLabel
      ? inheritLabel
      : t('placeholder');

  const panel = open ? (
    <div className="voice-picker-panel" role="presentation" ref={panelRef} style={panelStyle}>
      <label className="voice-picker-search" htmlFor={searchId}>
        <span className="sr-only">{t('search')}</span>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          autoComplete="off"
        />
      </label>

      <ul
        id={listboxId}
        className="voice-picker-list"
        role="listbox"
        aria-label={t('listAria')}
        ref={listRef}
      >
        {inheritLabel ? (
          <li role="option" aria-selected={!value}>
            <button
              type="button"
              className={`voice-picker-row${!value ? ' is-selected' : ''}`}
              onClick={() => selectVoice('')}
            >
              <span className="voice-picker-avatar voice-picker-avatar-md voice-picker-avatar-inherit">
                ∞
              </span>
              <span className="voice-picker-row-body">
                <span className="voice-picker-row-name">{inheritLabel}</span>
                <span className="voice-picker-row-desc">{t('inheritHint')}</span>
              </span>
            </button>
          </li>
        ) : null}

        {filtered.map((voice) => {
          const selectedRow = value === voice.id;
          const canPreview =
            Boolean(voice.previewUrl) ||
            provider === 'edge' ||
            provider === 'openai' ||
            provider === 'elevenlabs' ||
            provider === 'auto';
          const isLoading = loadingId === voice.id;
          const isPlaying = playingId === voice.id;
          return (
            <li key={voice.id} role="option" aria-selected={selectedRow}>
              <div className={`voice-picker-row${selectedRow ? ' is-selected' : ''}`}>
                <button
                  type="button"
                  className="voice-picker-row-main"
                  onClick={() => selectVoice(voice.id)}
                >
                  <VoiceAvatar voice={voice} />
                  <span className="voice-picker-row-body">
                    <span className="voice-picker-row-name">{voice.label}</span>
                    <span className="voice-picker-row-desc">
                      {[voice.accent, voice.gender, voice.description].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`voice-picker-play${isPlaying ? ' is-playing' : ''}${isLoading ? ' is-loading' : ''}`}
                  disabled={!canPreview || (loadingId != null && !isLoading)}
                  title={canPreview ? t('preview') : t('previewUnavailable')}
                  aria-label={
                    isPlaying
                      ? t('stopPreview', { name: voice.label })
                      : t('playPreview', { name: voice.label })
                  }
                  onMouseDown={(e) => {
                    // Keep panel open; don't let document mousedown steal focus oddly.
                    e.stopPropagation();
                  }}
                  onClick={(e) => void togglePreview(voice, e)}
                >
                  <PlayIcon playing={isPlaying} loading={isLoading} />
                </button>
              </div>
            </li>
          );
        })}

        {filtered.length === 0 ? <li className="voice-picker-empty">{t('empty')}</li> : null}
      </ul>

      <div className="voice-picker-footer" aria-live="polite">
        {t('voiceCount', { count: filtered.length, total: enriched.length })}
      </div>
    </div>
  ) : null;

  return (
    <div
      className={`voice-picker${className ? ` ${className}` : ''}${open ? ' is-open' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        id={id}
        className="voice-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
      >
        <VoiceAvatar voice={selected} />
        <span className="voice-picker-trigger-text">
          <span className="voice-picker-trigger-name">{triggerLabel}</span>
          {selected ? (
            <span className="voice-picker-trigger-meta">
              {[selected.accent, selected.gender].filter(Boolean).join(' · ')}
            </span>
          ) : inheritLabel ? (
            <span className="voice-picker-trigger-meta">{t('inheritHint')}</span>
          ) : null}
        </span>
        <span className="voice-picker-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
