'use client';

import { useMemo, useState } from 'react';

export function CodeBlock({
  code,
  language,
}: {
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);
  const trimmed = useMemo(() => code.replace(/\n+$/, ''), [code]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // noop
    }
  }

  return (
    <div className="docs-codeblock">
      <div className="docs-codeblock-top">
        <span className="docs-codeblock-lang">{language || 'code'}</span>
        <button type="button" className="docs-codeblock-copy" onClick={onCopy}>
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="docs-pre">
        <code>{trimmed}</code>
      </pre>
    </div>
  );
}

