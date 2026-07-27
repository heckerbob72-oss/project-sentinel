"use client";

import { useMemo, useState } from "react";

import type { Risk } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * 5x5 probability × impact heat grid. Each cell is coloured by its risk
 * exposure (prob × impact) and stacks the risks that land there. Handles both
 * 1..5 scales and 0..1 scales by normalising into 5 buckets.
 */

const LEVELS = [1, 2, 3, 4, 5];

function toBucket(raw: number): number {
  if (raw <= 1) return Math.max(1, Math.min(5, Math.round(raw * 5)));
  return Math.max(1, Math.min(5, Math.round(raw)));
}

function cellClasses(prob: number, impact: number): string {
  const exposure = prob * impact; // 1..25
  if (exposure >= 15) return "bg-status-critical/25 border-status-critical/40";
  if (exposure >= 9) return "bg-status-red/20 border-status-red/40";
  if (exposure >= 4) return "bg-status-amber/15 border-status-amber/30";
  return "bg-status-green/10 border-status-green/25";
}

export function RiskMatrix({
  risks,
  onSelect,
}: {
  risks: Risk[];
  onSelect?: (risk: Risk) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const grid = useMemo(() => {
    const map = new Map<string, Risk[]>();
    for (const r of risks) {
      const p = toBucket(r.probability);
      const i = toBucket(r.impact);
      const key = `${p}-${i}`;
      const bucket = map.get(key) ?? [];
      bucket.push(r);
      map.set(key, bucket);
    }
    return map;
  }, [risks]);

  return (
    <div className="flex gap-3">
      {/* Y axis label */}
      <div className="flex items-center">
        <span className="rotate-180 text-[10px] font-medium uppercase tracking-wider text-muted-foreground [writing-mode:vertical-rl]">
          Probability →
        </span>
      </div>

      <div className="flex-1">
        <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-1">
          {/* rows: probability 5 (top) .. 1 (bottom) */}
          {[...LEVELS].reverse().map((prob) => (
            <div key={`row-${prob}`} className="contents">
              <div className="flex w-5 items-center justify-center text-[10px] text-muted-foreground">
                {prob}
              </div>
              {LEVELS.map((impact) => {
                const key = `${prob}-${impact}`;
                const cellRisks = grid.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className={cn(
                      "relative flex min-h-[54px] flex-col gap-1 rounded-md border p-1 transition-colors",
                      cellClasses(prob, impact),
                    )}
                  >
                    {cellRisks.map((r) => (
                      <button
                        key={r.rule_id}
                        onClick={() => onSelect?.(r)}
                        onMouseEnter={() => setHovered(r.rule_id)}
                        onMouseLeave={() => setHovered(null)}
                        title={`${r.title} (${r.severity})`}
                        className={cn(
                          "truncate rounded bg-surface/80 px-1.5 py-0.5 text-left text-[10px] font-medium text-foreground ring-1 ring-border transition",
                          hovered === r.rule_id && "ring-sentinel-400",
                        )}
                      >
                        {r.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}

          {/* X axis */}
          <div />
          {LEVELS.map((impact) => (
            <div
              key={`x-${impact}`}
              className="pt-1 text-center text-[10px] text-muted-foreground"
            >
              {impact}
            </div>
          ))}
        </div>
        <p className="mt-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Impact →
        </p>
      </div>
    </div>
  );
}
