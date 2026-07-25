'use client';

import { translate } from '@/lib/i18n';

function detectLocale(): 'es' | 'en' {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement.lang || navigator.language;
    if (lang.startsWith('en')) return 'en';
  }
  return 'es';
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = detectLocale();
  const title = translate(locale, 'errors.globalTitle');
  const desc = translate(locale, 'errors.globalDesc');
  const retry = translate(locale, 'common.retry');

  return (
    <html lang={locale}>
      <body>
        <main style={{ maxWidth: 720, margin: '40px auto', padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
          <h1>{title}</h1>
          <p style={{ opacity: 0.8 }}>{desc}</p>
          <pre style={{ background: '#111', color: '#eee', padding: 12, borderRadius: 8, overflow: 'auto' }}>
            {error.message}
            {error.digest ? `\n\nDigest: ${error.digest}` : ''}
          </pre>
          <button onClick={() => reset()} style={{ marginTop: 12, padding: '8px 12px' }}>
            {retry}
          </button>
        </main>
      </body>
    </html>
  );
}
