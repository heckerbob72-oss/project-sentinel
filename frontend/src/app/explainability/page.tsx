"use client";

import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, Fingerprint, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiGetData } from "@/lib/api";
import type { AuditEntry, ExplainabilityRecord } from "@/lib/types";
import { cn, formatPercent, timeAgo } from "@/lib/utils";

export default function ExplainabilityPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");

  const {
    data: audit,
    isLoading: auditLoading,
    isError: auditError,
  } = useQuery({
    queryKey: ["audit"],
    queryFn: () => apiGetData<AuditEntry[]>("/audit"),
    retry: 0,
  });

  // Auto-select the most recent entry once the log loads.
  useEffect(() => {
    if (!selected && audit && audit.length > 0) {
      setSelected(audit[0].audit_id);
    }
  }, [audit, selected]);

  const {
    data: record,
    isLoading: recordLoading,
    isError: recordError,
  } = useQuery({
    queryKey: ["explainability", selected],
    queryFn: () => apiGetData<ExplainabilityRecord>(`/explainability/${selected}`),
    enabled: Boolean(selected),
    retry: 0,
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <BrainCircuit size={20} className="text-sentinel-300" /> Explainability
          Mode
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Prove any recommendation end-to-end: source facts, the rule that fired,
          the calculation, alternatives considered, and confidence.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Audit list */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle icon={<Fingerprint size={15} className="text-sentinel-300" />}>
              Decision Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualId.trim()) setSelected(manualId.trim());
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="audit_id…"
                  className="focus-ring h-9 w-full rounded-lg border border-input bg-surface pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground/60"
                />
              </div>
              <Button type="submit" size="sm" variant="secondary">
                Trace
              </Button>
            </form>

            {auditLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : auditError ? (
              <EmptyState
                variant="error"
                title="Audit log unavailable"
                description="Enter a specific audit_id above to trace it directly."
              />
            ) : !audit?.length ? (
              <EmptyState
                title="No decisions logged"
                description="Recommendations across the app will appear here for inspection."
              />
            ) : (
              <ul className="max-h-[540px] space-y-1.5 overflow-y-auto pr-1">
                {audit.map((entry) => {
                  const active = selected === entry.audit_id;
                  return (
                    <li key={entry.audit_id}>
                      <button
                        onClick={() => setSelected(entry.audit_id)}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                          active
                            ? "border-sentinel-500/50 bg-sentinel-600/10"
                            : "border-border bg-surface hover:bg-surface-overlay",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {entry.action}
                          </span>
                          <Badge variant="muted">{entry.module}</Badge>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <code className="truncate font-mono">
                            {entry.audit_id}
                          </code>
                          <span>{timeAgo(entry.timestamp)}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Trace detail */}
        <div className="space-y-4 lg:col-span-2">
          {!selected ? (
            <EmptyState
              title="Select a decision to trace"
              description="Choose an entry from the decision log, or paste an audit_id."
              icon={<BrainCircuit size={26} className="text-muted-foreground" />}
            />
          ) : recordLoading ? (
            <Card className="p-5">
              <Skeleton className="mb-3 h-6 w-1/2" />
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </Card>
          ) : recordError || !record ? (
            <EmptyState
              variant="error"
              title="Couldn't load this trace"
              description={`No explainability record was returned for "${selected}". Check the audit_id and try again.`}
            />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle icon={<Fingerprint size={15} className="text-sentinel-300" />}>
                    Trace {record.audit_id}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="brand">{record.module}</Badge>
                    <Badge variant="muted">{record.agent}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <TraceStat
                    label="Confidence"
                    value={formatPercent(record.explanation?.confidence ?? 0)}
                  />
                  <TraceStat
                    label="Evidence"
                    value={String(record.explanation?.evidence?.length ?? 0)}
                  />
                  <TraceStat
                    label="Rules"
                    value={String(record.explanation?.rules_triggered?.length ?? 0)}
                  />
                  <TraceStat
                    label="Calculations"
                    value={String(record.explanation?.calculations?.length ?? 0)}
                  />
                </CardContent>
              </Card>

              <ExplanationPanel
                explanation={record.explanation}
                title="Full decision trace"
                defaultOpen
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TraceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="stat-label">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
