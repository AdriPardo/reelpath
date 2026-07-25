'use client';

import { useContext, type ComponentProps } from 'react';
import { OlDepthContext } from './MarkdownLists';

export function StepLi({ children, className, ...props }: ComponentProps<'li'>) {
  const depth = useContext(OlDepthContext);
  const isTopLevelOl = depth === 1;

  if (isTopLevelOl) {
    return (
      <li {...props} className={['docs-ol-item', className].filter(Boolean).join(' ')}>
        {children}
      </li>
    );
  }

  return (
    <li {...props} className={className}>
      {children}
    </li>
  );
}
