import type { ReactNode } from 'react';

export default function HelpLayout({ children }: { children: ReactNode }) {
  return <div className="help-root">{children}</div>;
}

