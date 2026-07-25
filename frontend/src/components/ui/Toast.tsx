'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

type ToastType = 'success' | 'error' | 'info' | 'celebrate';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4500;

const TOAST_ICON: Record<ToastType, string> = {
  success: '✓',
  error: '!',
  info: 'i',
  celebrate: '🎉',
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast-${item.type}`} role="status">
            <span className="toast-icon" aria-hidden="true">
              {TOAST_ICON[item.type]}
            </span>
            <span className="toast-message">{item.message}</span>
            <button
              type="button"
              className="toast-dismiss"
              aria-label={t('closeNotification')}
              onClick={() => dismiss(item.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
