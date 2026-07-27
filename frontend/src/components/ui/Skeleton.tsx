import { cn } from "@/lib/utils";

/** A shimmering placeholder block used while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-overlay/60",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-shimmer before:bg-gradient-to-r",
        "before:from-transparent before:via-white/5 before:to-transparent",
        className,
      )}
    />
  );
}

/** Convenience: a stack of text-line skeletons. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/** A grid of card-shaped skeletons for KPI / list loading states. */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel p-5">
          <Skeleton className="mb-3 h-3 w-24" />
          <Skeleton className="mb-2 h-8 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}
