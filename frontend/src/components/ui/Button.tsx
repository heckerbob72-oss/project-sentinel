import { forwardRef, type ButtonHTMLAttributes } from "react";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-sentinel-600 text-white hover:bg-sentinel-500 border border-sentinel-500/60 shadow-sm",
  secondary:
    "bg-surface-overlay text-foreground hover:bg-muted border border-border",
  outline:
    "bg-transparent text-foreground hover:bg-surface-overlay border border-border",
  ghost: "bg-transparent text-muted-foreground hover:text-foreground hover:bg-surface-overlay",
  danger:
    "bg-status-red/90 text-white hover:bg-status-red border border-status-red/60",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-sm gap-2",
  icon: "h-9 w-9 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
          "focus-ring disabled:pointer-events-none disabled:opacity-50",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      >
        {loading ? <Spinner size={16} className="text-current" /> : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
