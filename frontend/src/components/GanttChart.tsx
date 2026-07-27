"use client";

import { useMemo } from "react";

import type { GanttBar } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Lightweight div-based Gantt. Bars are positioned on a shared 0..duration
 * scale; critical-path tasks render red. No chart library needed — this keeps
 * dense schedules readable on dark surfaces.
 */
export function GanttChart({
  bars,
  projectDuration,
}: {
  bars: GanttBar[];
  projectDuration?: number;
}) {
  const total = useMemo(() => {
    const maxEnd = bars.reduce((m, b) => Math.max(m, b.end), 0);
    return Math.max(projectDuration ?? 0, maxEnd, 1);
  }, [bars, projectDuration]);

  // Tick marks (~6 gridlines)
  const ticks = useMemo(() => {
    const step = Math.max(1, Math.ceil(total / 6));
    const out: number[] = [];
    for (let d = 0; d <= total; d += step) out.push(d);
    if (out[out.length - 1] !== total) out.push(total);
    return out;
  }, [total]);

  if (!bars.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No schedule bars to display.
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header scale */}
      <div className="relative mb-2 ml-44 h-4 border-b border-border">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute -translate-x-1/2 text-[10px] text-muted-foreground"
            style={{ left: `${(t / total) * 100}%` }}
          >
            {t}d
          </span>
        ))}
      </div>

      <div className="space-y-1.5">
        {bars.map((b) => {
          const left = (b.start / total) * 100;
          const width = Math.max(((b.end - b.start) / total) * 100, 1.5);
          return (
            <div key={b.task_id} className="flex items-center gap-2">
              <div
                className="w-44 shrink-0 truncate text-xs text-muted-foreground"
                title={b.label}
              >
                <span className="font-mono text-[10px] text-muted-foreground/70">
                  {b.task_id}
                </span>{" "}
                {b.label}
              </div>
              <div className="relative h-6 flex-1 rounded bg-surface-overlay/40">
                {/* gridlines */}
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="absolute top-0 h-full w-px bg-border/50"
                    style={{ left: `${(t / total) * 100}%` }}
                  />
                ))}
                <div
                  className={cn(
                    "absolute top-1/2 flex h-4 -translate-y-1/2 items-center rounded px-1.5 text-[10px] font-medium text-white shadow-sm",
                    b.critical
                      ? "bg-status-red/90 ring-1 ring-status-red"
                      : "bg-sentinel-600/90 ring-1 ring-sentinel-500/50",
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${b.label}: day ${b.start}–${b.end}${b.critical ? " (critical)" : ""}`}
                >
                  <span className="truncate">{b.end - b.start}d</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded bg-sentinel-600/90" /> Standard task
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded bg-status-red/90" /> Critical path
        </span>
      </div>
    </div>
  );
}
