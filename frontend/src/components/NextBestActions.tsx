"use client";

import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import type { NextAction } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: "border-l-status-critical",
  high: "border-l-status-red",
  medium: "border-l-status-amber",
  low: "border-l-status-green",
};

function priorityVariant(p: string): "danger" | "warning" | "success" | "muted" {
  switch (p.toLowerCase()) {
    case "critical":
    case "high":
      return "danger";
    case "medium":
      return "warning";
    case "low":
      return "success";
    default:
      return "muted";
  }
}

/** Maps a module name to its in-app route, when one exists. */
function moduleHref(module: string | undefined): string | null {
  if (!module) return null;
  const slug = module.toLowerCase().replace(/[_\s]+/g, "-");
  const known = new Set([
    "health",
    "risks",
    "wbs",
    "simulation",
    "explainability",
    "dependencies",
    "timeline",
    "gantt",
    "resources",
    "recovery",
    "rescue",
    "intake",
  ]);
  return known.has(slug) ? `/${slug}` : null;
}

/**
 * Renders the API's next_actions[] as prioritised, colour-coded cards.
 * Sorted by priority; each links to its owning module when routable.
 */
export function NextBestActions({
  actions,
  className,
  emptyLabel = "No recommended actions right now.",
}: {
  actions: NextAction[] | undefined;
  className?: string;
  emptyLabel?: string;
}) {
  const sorted = [...(actions ?? [])].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority?.toLowerCase()] ?? 9) -
      (PRIORITY_ORDER[b.priority?.toLowerCase()] ?? 9),
  );

  if (!sorted.length) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {sorted.map((a, i) => {
        const href = moduleHref(a.module);
        const body = (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border border-l-2 border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-overlay/60",
              PRIORITY_STYLES[a.priority?.toLowerCase()] ?? "border-l-border",
            )}
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sentinel-600/15 text-sentinel-300">
              <Zap size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">{a.action}</p>
                <Badge variant={priorityVariant(a.priority)}>{a.priority}</Badge>
                {a.module ? (
                  <span className="text-[11px] text-muted-foreground">
                    {a.module}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>
            </div>
            {href ? (
              <ArrowRight
                size={16}
                className="mt-1 shrink-0 text-muted-foreground"
              />
            ) : null}
          </div>
        );
        return href ? (
          <Link key={i} href={href} className="block">
            {body}
          </Link>
        ) : (
          <div key={i}>{body}</div>
        );
      })}
    </div>
  );
}
