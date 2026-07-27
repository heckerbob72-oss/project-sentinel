import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("panel", className)} {...props} />;
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-border px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  children,
  icon,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { icon?: ReactNode }) {
  return (
    <h3
      className={cn(
        "flex items-center gap-2 text-sm font-semibold text-foreground",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mt-0.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-border px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}

/** A compact KPI stat block. */
export function StatCard({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <span className="stat-label">{label}</span>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <div className={cn("mt-2 text-3xl font-semibold tabular-nums", accent)}>
        {value}
      </div>
      {hint ? (
        <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </Card>
  );
}
