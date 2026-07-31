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
import { apiFetch } from '@/lib/api';

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

function PlayIcon({ playing }: { playing: boolean }) {
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
  const autoId = useId();
  const listboxId = `${autoId}-listbox`;
  const searchId = `${autoId}-search`;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
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
        /* curated list still works without previews */
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
    const gap = 6;
    const maxHeight = Math.min(22 * 16, window.innerHeight * 0.6);
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
    const spaceAbove = rect.top - gap - 8;
    const openUp = spaceBelow < Math.min(maxHeight, 280) && spaceAbove > spaceBelow;
    const height = Math.min(maxHeight, openUp ? spaceAbove : spaceBelow);
    setPanelStyle({
      position: 'fixed',
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
      maxHeight: Math.max(160, height),
      zIndex: 10050,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + gap, top: 'auto' }
        : { top: rect.bottom + gap, bottom: 'auto' }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

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

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
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

  const stopPreview = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  }, []);

  const togglePreview = useCallback(
    async (voice: VoicePickerOption, e?: MouseEvent) => {
      e?.stopPropagation();
      e?.preventDefault();
      if (!voice.previewUrl) return;
      if (playingId === voice.id) {
        stopPreview();
        return;
      }
      stopPreview();
      const audio = new Audio(voice.previewUrl);
      audioRef.current = audio;
      setPlayingId(voice.id);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      try {
        await audio.play();
      } catch {
        setPlayingId(null);
      }
    },
    [playingId, stopPreview],
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
          autoFocus
        />
      </label>

      <ul id={listboxId} className="voice-picker-list" role="listbox" aria-label={t('listAria')}>
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
          const canPreview = Boolean(voice.previewUrl);
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
                  className={`voice-picker-play${playingId === voice.id ? ' is-playing' : ''}`}
                  disabled={!canPreview}
                  title={canPreview ? t('preview') : t('previewUnavailable')}
                  aria-label={
                    playingId === voice.id
                      ? t('stopPreview', { name: voice.label })
                      : t('playPreview', { name: voice.label })
                  }
                  onClick={(e) => togglePreview(voice, e)}
                >
                  <PlayIcon playing={playingId === voice.id} />
                </button>
              </div>
            </li>
          );
        })}

        {filtered.length === 0 ? <li className="voice-picker-empty">{t('empty')}</li> : null}
      </ul>
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
