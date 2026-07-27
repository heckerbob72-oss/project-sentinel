"use client";

import {
  Calculator,
  ChevronDown,
  FlaskConical,
  GitCompareArrows,
  Info,
  ListChecks,
  Quote,
  ShieldCheck,
  Sigma,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import type { Explanation } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * The product's signature component: renders a structured {@link Explanation}
 * so no recommendation is ever a black box. Sections are individually present
 * only when they carry data. Collapsible with a confidence meter and the
 * originating agent + timestamp.
 */
export function ExplanationPanel({
  explanation,
  title = "Why this?",
  defaultOpen = false,
  className,
  compact = false,
}: {
  explanation: Explanation | undefined | null;
  title?: string;
  defaultOpen?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!explanation) return null;

  const confidencePct = Math.round((explanation.confidence ?? 0) * 100);
  const confColor =
    confidencePct >= 80
      ? "bg-status-green"
      : confidencePct >= 50
        ? "bg-status-amber"
        : "bg-status-red";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface/60",
        className,
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sentinel-600/15 text-sentinel-300">
          <ShieldCheck size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {title}
            </span>
            <Badge variant="brand" className="hidden sm:inline-flex">
              {explanation.agent}
            </Badge>
          </span>
          <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
            {explanation.summary}
          </span>
        </span>
        <span className="hidden items-center gap-2 md:flex">
          <span className="text-[11px] text-muted-foreground">
            {confidencePct}% conf
          </span>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-overlay">
            <span
              className={cn("block h-full rounded-full", confColor)}
              style={{ width: `${confidencePct}%` }}
            />
          </span>
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <Section icon={<Info size={13} />} title="Summary">
            <p className="text-sm text-foreground/90">{explanation.summary}</p>
          </Section>

          {explanation.reasoning?.length ? (
            <Section icon={<ListChecks size={13} />} title="Reasoning">
              <ol className="space-y-1.5">
                {explanation.reasoning.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/85">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-overlay text-[10px] font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          {explanation.evidence?.length ? (
            <Section icon={<Quote size={13} />} title="Evidence">
              <div className="space-y-1.5">
                {explanation.evidence.map((e, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="truncate font-mono text-[11px] text-sentinel-300">
                        {e.source}
                      </code>
                      {e.value !== null && e.value !== undefined ? (
                        <span className="shrink-0 rounded bg-surface-overlay px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                          {formatValue(e.value)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.detail}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {explanation.rules_triggered?.length ? (
            <Section icon={<Sigma size={13} />} title="Rules triggered">
              <div className="flex flex-wrap gap-1.5">
                {explanation.rules_triggered.map((rule) => (
                  <code
                    key={rule}
                    className="rounded-md border border-status-amber/30 bg-status-amber/10 px-2 py-0.5 font-mono text-[11px] text-status-amber"
                  >
                    {rule}
                  </code>
                ))}
              </div>
            </Section>
          ) : null}

          {explanation.calculations?.length ? (
            <Section icon={<Calculator size={13} />} title="Calculations">
              <div className="space-y-2">
                {explanation.calculations.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {c.name}
                      </span>
                      <span className="rounded bg-sentinel-600/15 px-2 py-0.5 font-mono text-[11px] text-sentinel-200">
                        = {formatValue(c.result)}
                      </span>
                    </div>
                    <code className="mt-1 block font-mono text-[11px] text-muted-foreground">
                      {c.formula}
                    </code>
                    {c.inputs && Object.keys(c.inputs).length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {Object.entries(c.inputs).map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded bg-surface-overlay px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {k}={formatValue(v)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {!compact && explanation.assumptions?.length ? (
            <Section icon={<FlaskConical size={13} />} title="Assumptions">
              <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                {explanation.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </Section>
          ) : null}

          {!compact && explanation.alternatives?.length ? (
            <Section icon={<GitCompareArrows size={13} />} title="Alternatives considered">
              <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                {explanation.alternatives.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </Section>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
            <span>
              Agent: <span className="text-foreground/80">{explanation.agent}</span>
            </span>
            <span>{formatDateTime(explanation.timestamp)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatValue(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
