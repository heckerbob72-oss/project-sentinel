import type { StatusColor } from "@/lib/types";
import { cn, statusStyle } from "@/lib/utils";

/**
 * Maps a health/traffic-light status (green|amber|red|critical) to a coloured
 * pill with a leading dot. Falls back gracefully for unknown values.
 */
export function StatusBadge({
  status,
  label,
  className,
  showDot = true,
  size = "md",
}: {
  status: StatusColor | string | undefined;
  label?: string;
  className?: string;
  showDot?: boolean;
  size?: "sm" | "md";
}) {
  const style = statusStyle(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium capitalize",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        style.pill,
        className,
      )}
    >
      {showDot ? (
        <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      ) : null}
      {label ?? style.label}
    </span>
  );
}

/** A bare coloured dot — for dense table cells. */
export function StatusDot({
  status,
  className,
  title,
}: {
  status: StatusColor | string | undefined;
  className?: string;
  title?: string;
}) {
  const style = statusStyle(status);
  return (
    <span
      title={title ?? style.label}
      className={cn("inline-block h-2.5 w-2.5 rounded-full", style.dot, className)}
    />
  );
}
