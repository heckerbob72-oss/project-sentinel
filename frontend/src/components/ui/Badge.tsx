import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "outline"
  | "brand"
  | "muted"
  | "success"
  | "warning"
  | "danger";

const VARIANTS: Record<BadgeVariant, string> = {
  default: "bg-surface-overlay text-foreground border-border",
  outline: "bg-transparent text-muted-foreground border-border",
  brand: "bg-sentinel-500/15 text-sentinel-300 border-sentinel-500/30",
  muted: "bg-muted/60 text-muted-foreground border-transparent",
  success: "bg-status-green/10 text-status-green border-status-green/30",
  warning: "bg-status-amber/10 text-status-amber border-status-amber/30",
  danger: "bg-status-red/10 text-status-red border-status-red/30",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
