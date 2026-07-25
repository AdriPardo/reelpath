'use client';

import { createContext, useContext, type ReactNode } from 'react';

const OlDepthContext = createContext(0);

export function MarkdownOl({ children }: { children: ReactNode }) {
  const depth = useContext(OlDepthContext);
  const className = depth > 0 ? 'docs-nested-ol' : 'docs-ol';

  return (
    <OlDepthContext.Provider value={depth + 1}>
      <ol className={className}>{children}</ol>
    </OlDepthContext.Provider>
  );
}

export function MarkdownUl({ children }: { children: ReactNode }) {
  return <ul className="docs-ul">{children}</ul>;
}

export { OlDepthContext };
