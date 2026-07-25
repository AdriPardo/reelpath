'use client';

import { useState } from 'react';

export function CopyHeadingLink({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      const url = new URL(window.location.href);
      url.hash = id;
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // noop
    }
  }

  return (
    <button type="button" className="docs-heading-copy" onClick={onCopy} aria-label="Copiar enlace">
      {copied ? 'Copiado' : 'Link'}
    </button>
  );
}

