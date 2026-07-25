'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

interface VideoEditFormProps {
  videoId: string;
  initialTitle: string;
  initialDescription: string;
  initialTags: string[];
  disabled?: boolean;
}

export function VideoEditForm({
  videoId,
  initialTitle,
  initialDescription,
  initialTags,
  disabled,
}: VideoEditFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [tagsText, setTagsText] = useState(initialTags.join(', '));
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const tags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await api(`/api/videos/${videoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, description, tags }),
      });

      toast('Metadatos guardados', 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al guardar', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="video-edit-form" onSubmit={save}>
      <label className="modal-field">
        Título
        <input
          className="topic-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled || loading}
          maxLength={200}
        />
      </label>
      <label className="modal-field">
        Descripción
        <textarea
          className="topic-input video-edit-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled || loading}
          rows={4}
        />
      </label>
      <label className="modal-field">
        Tags (separados por coma)
        <input
          className="topic-input"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          disabled={disabled || loading}
        />
      </label>
      <Button type="submit" variant="secondary" disabled={disabled || loading}>
        {loading ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </form>
  );
}
