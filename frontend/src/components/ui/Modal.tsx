"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-lg animate-fade-in rounded-xl border border-border bg-surface-raised shadow-panel",
          className,
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between border-b border-border px-5 py-4">
            <div>
              {title ? (
                <h2 className="text-sm font-semibold text-foreground">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className="link-muted rounded-md p-1"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
