import { Inbox, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Friendly placeholder for empty / error states. When the backend is down we
 * prefer this over a crash — pass variant="error" for a subtle warning tint.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  variant = "empty",
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: "empty" | "error";
  className?: string;
}) {
  const fallbackIcon =
    variant === "error" ? (
      <TriangleAlert className="text-status-amber" size={28} />
    ) : (
      <Inbox className="text-muted-foreground" size={28} />
    );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 px-6 py-14 text-center",
        variant === "error" && "border-status-amber/30 bg-status-amber/5",
        className,
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-overlay">
        {icon ?? fallbackIcon}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
