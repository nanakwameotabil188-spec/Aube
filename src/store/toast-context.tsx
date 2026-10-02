'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils/cn';

/**
 * Toast notifications.
 *
 * Add-to-cart and wishlist feedback is announced politely so it reaches
 * screen readers without interrupting whatever the user is doing.
 */

type ToastTone = 'default' | 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  notify: (message: string, options?: { tone?: ToastTone; action?: Toast['action']; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const notify = useCallback<ToastContextValue['notify']>(
    (message, options) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, message, tone: options?.tone ?? 'default', action: options?.action }]);
      const duration = options?.duration ?? 4200;
      timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-90 flex flex-col items-center gap-2 px-4 pb-6 sm:items-end sm:px-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'animate-scale-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-md px-4 py-3 text-sm shadow-overlay',
              toast.tone === 'success' && 'bg-moss text-shell',
              toast.tone === 'error' && 'bg-danger text-shell',
              toast.tone === 'default' && 'bg-ink text-shell',
            )}
          >
            {toast.tone === 'success' && <Icon name="check" className="size-4 shrink-0" aria-hidden />}
            <span className="flex-1 leading-snug">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
                className="link-underline shrink-0 font-medium underline-offset-4"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="-mr-1 shrink-0 rounded-xs p-1 opacity-70 transition-opacity hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <Icon name="close" className="size-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}
