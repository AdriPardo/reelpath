'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getApiUrl } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { ButtonLink } from '@/components/ui/Button';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

const MAX_SIZE_MB = 500;
const ACCEPTED_TYPES = ['video/mp4'];

type UploadPhase = 'idle' | 'uploading' | 'success' | 'error';

function isMp4(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type) || file.name.toLowerCase().endsWith('.mp4');
}

function uploadWithProgress(
  url: string,
  form: FormData,
  token: string | null,
  onProgress: (pct: number) => void,
  messages: {
    invalidResponse: string;
    uploadFailed: string;
    networkError: string;
    uploadCancelled: string;
  },
): Promise<{ videoId?: string; message?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      const text = xhr.responseText;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(text) as { videoId?: string; message?: string });
        } catch {
          reject(new Error(messages.invalidResponse));
        }
        return;
      }
      let message = messages.uploadFailed;
      try {
        const data = JSON.parse(text) as { error?: string };
        if (data.error) message = data.error;
      } catch {
        /* ignore */
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error(messages.networkError));
    xhr.onabort = () => reject(new Error(messages.uploadCancelled));
    xhr.send(form);
  });
}

export function UploadLongVideoButton({ channelId }: { channelId: string }) {
  const t = useTranslations('channels.uploadLong');
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const dropzoneId = useId();
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploading = phase === 'uploading';
  const disabled = uploading || phase === 'success';

  const uploadMessages = {
    invalidResponse: t('invalidResponse'),
    uploadFailed: t('uploadFailed'),
    networkError: t('networkError'),
    uploadCancelled: t('uploadCancelled'),
  };

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!isMp4(file)) return t('mp4Only');
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        return t('fileTooLarge', { max: MAX_SIZE_MB });
      }
      return null;
    },
    [t],
  );

  const pickFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setSelectedFile(null);
        setPhase('error');
        return;
      }
      setError(null);
      setSelectedFile(file);
      if (phase === 'error' || phase === 'success') setPhase('idle');
    },
    [phase, validateFile],
  );

  async function startUpload(file: File) {
    setPhase('uploading');
    setError(null);
    setProgress(0);
    setVideoId(null);

    try {
      const form = new FormData();
      form.append('video', file);
      if (title.trim()) form.append('title', title.trim());

      const token = getToken();
      const data = await uploadWithProgress(
        `${getApiUrl()}/api/channels/${channelId}/upload-long`,
        form,
        token,
        setProgress,
        uploadMessages,
      );

      if (data.videoId) {
        setVideoId(data.videoId);
        setPhase('success');
      } else {
        throw new Error(t('noVideoId'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('uploadError'));
      setPhase('error');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleUploadClick() {
    if (!selectedFile || uploading) return;
    void startUpload(selectedFile);
  }

  function resetForm() {
    setPhase('idle');
    setProgress(0);
    setError(null);
    setSelectedFile(null);
    setVideoId(null);
    setTitle('');
    if (inputRef.current) inputRef.current.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) pickFile(file);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <section className="upload-long-panel" aria-labelledby={`upload-long-heading-${channelId}`}>
      <div className="upload-long-panel-glow" aria-hidden="true" />

      <header className="upload-long-header">
        <div className="upload-long-title-row">
          <span className="upload-long-eyebrow">{t('importEyebrow')}</span>
          <InfoTooltip
            content={t('tooltip', { max: MAX_SIZE_MB })}
            ariaLabel={t('tooltipAria')}
          />
        </div>
        <h3 id={`upload-long-heading-${channelId}`} className="upload-long-title">
          {t('title')}
        </h3>
        <p className="upload-long-desc">{t('desc')}</p>
      </header>

      {phase === 'success' && videoId ? (
        <div className="upload-long-result upload-long-result-success" role="status">
          <p className="upload-long-result-title">{t('successTitle')}</p>
          <p className="upload-long-result-text">{t('successText')}</p>
          <div className="upload-long-result-actions">
            <ButtonLink href={`/videos/${videoId}`} variant="primary" className="upload-long-cta">
              {t('viewVideo')}
            </ButtonLink>
            <button type="button" className="btn btn-secondary" onClick={resetForm}>
              {t('uploadAnother')}
            </button>
          </div>
        </div>
      ) : (
        <div className="upload-long-form">
          <div className="upload-long-field">
            <label htmlFor={titleId} className="upload-long-field-label">
              {t('titleLabel')}
            </label>
            <input
              id={titleId}
              type="text"
              className="upload-long-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              maxLength={200}
              disabled={disabled}
            />
            <p className="upload-long-field-hint">{t('titleHint')}</p>
          </div>

          <div
            id={dropzoneId}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={t('dropzoneAria')}
            aria-disabled={disabled}
            className={`upload-long-dropzone${dragOver ? ' upload-long-dropzone-active' : ''}${selectedFile ? ' upload-long-dropzone-has-file' : ''}${disabled ? ' upload-long-dropzone-disabled' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={onDrop}
            onClick={() => {
              if (!disabled) inputRef.current?.click();
            }}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,.mp4"
              hidden
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickFile(file);
              }}
            />

            {selectedFile ? (
              <>
                <span className="upload-long-dropzone-icon" aria-hidden="true">
                  ✓
                </span>
                <span className="upload-long-dropzone-filename">{selectedFile.name}</span>
                <span className="upload-long-dropzone-meta">
                  {formatFileSize(selectedFile.size)} · MP4
                </span>
                {!uploading && (
                  <span className="upload-long-dropzone-change">{t('changeFile')}</span>
                )}
              </>
            ) : (
              <>
                <span className="upload-long-dropzone-icon" aria-hidden="true">
                  ↑
                </span>
                <span className="upload-long-dropzone-label">{t('dropLabel')}</span>
                <span className="upload-long-dropzone-meta">
                  {t('dropMeta', { max: MAX_SIZE_MB })}
                </span>
              </>
            )}
          </div>

          {uploading && (
            <div className="upload-long-progress" aria-live="polite">
              <div className="pipeline-progress pipeline-progress-active">
                <div className="pipeline-progress-track">
                  <div
                    className="pipeline-progress-fill"
                    style={{ width: `${Math.max(progress, 4)}%` }}
                  />
                </div>
                <div className="pipeline-progress-meta">
                  <span className="pipeline-progress-step">{t('uploadingVideo')}</span>
                  <span className="pipeline-progress-pct">{progress}%</span>
                </div>
              </div>
            </div>
          )}

          {phase === 'error' && error && (
            <div className="upload-long-result upload-long-result-error" role="alert">
              <p className="upload-long-result-title">{t('uploadFailedTitle')}</p>
              <p className="upload-long-result-text">{error}</p>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-lg upload-long-cta"
            disabled={!selectedFile || uploading}
            onClick={handleUploadClick}
          >
            {uploading ? (
              <>
                <span className="studio-cta-spinner" aria-hidden="true" />
                {t('uploading')}
              </>
            ) : (
              t('uploadAndShorts')
            )}
          </button>
        </div>
      )}
    </section>
  );
}
