"use client";

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type ToastVariant = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: {
    title: string;
    description?: string;
    variant?: ToastVariant;
  }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, ReactNode> = {
  info: <Info size={16} className="text-sentinel-300" />,
  success: <CheckCircle2 size={16} className="text-status-green" />,
  warning: <TriangleAlert size={16} className="text-status-amber" />,
  error: <XCircle size={16} className="text-status-red" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ title, description, variant = "info" }) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      window.setTimeout(() => remove(id), 5000);
    },
    [remove],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex animate-fade-in items-start gap-3 rounded-lg border border-border bg-surface-overlay p-3 shadow-panel",
            )}
          >
            <div className="mt-0.5">{ICONS[t.variant]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              {t.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.description}
                </p>
              ) : null}
            </div>
            <button
              onClick={() => remove(t.id)}
              className="link-muted rounded p-0.5"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail soft: outside the provider, log instead of crashing.
    return {
      toast: ({ title, description }) =>
        // eslint-disable-next-line no-console
        console.info("[toast]", title, description ?? ""),
    };
  }
  return ctx;
}
