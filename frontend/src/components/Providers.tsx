'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthGate, AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
