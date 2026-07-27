"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { RiskMatrix } from "@/components/RiskMatrix";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TBody, THead, TD, TH, TR, Table } from "@/components/ui/Table";
import { apiGetData } from "@/lib/api";
import type { Risk } from "@/lib/types";
import { formatNumber, severityToStatus } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

export default function RisksPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId);
  const projectName = useProjectStore((s) => s.selectedProjectName);
  const [openRisk, setOpenRisk] = useState<string | null>(null);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["risks", projectId],
    queryFn: () => apiGetData<{ risks: Risk[] }>(`/projects/${projectId}/risks`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  if (!projectId) {
    return (
      <div>
        <h1 className="mb-5 text-xl font-semibold text-foreground">Risk Register</h1>
        <EmptyState
          title="No project selected"
          description="Pick a project from the top bar to view its risks."
          action={
            <Link href="/control-tower" className="text-sm text-sentinel-300 hover:underline">
              Go to Control Tower →
            </Link>
          }
        />
      </div>
    );
  }

  const risks = data?.risks ?? [];
  const sorted = [...risks].sort((a, b) => b.score - a.score);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <AlertTriangle size={20} className="text-sentinel-300" /> Risk Register
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {projectName ?? "Selected project"} · {risks.length} identified risks
          </p>
        </div>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <Skeleton className="h-64 w-full" />
          </Card>
          <Card className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </Card>
        </div>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load risks"
          description="The risk API is unavailable. This view populates once the backend is online."
        />
      ) : !risks.length ? (
        <EmptyState
          title="No risks identified"
          description="The risk engine has not flagged any risks for this project."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Probability × Impact Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <RiskMatrix
                  risks={sorted}
                  onSelect={(r) => setOpenRisk(r.rule_id)}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Severity Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(["critical", "high", "medium", "low"] as const).map((sev) => {
                  const count = risks.filter(
                    (r) => severityToStatus(r.severity) === severityToStatus(sev),
                  ).length;
                  return (
                    <div
                      key={sev}
                      className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2"
                    >
                      <StatusBadge status={severityToStatus(sev)} label={sev} />
                      <span className="tabular-nums text-sm text-foreground">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Risk Detail</CardTitle>
            </CardHeader>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Risk</TH>
                  <TH>Category</TH>
                  <TH className="text-center">Severity</TH>
                  <TH className="text-right">Prob</TH>
                  <TH className="text-right">Impact</TH>
                  <TH className="text-right">Score</TH>
                </TR>
              </THead>
              <TBody>
                {sorted.map((r) => {
                  const isOpen = openRisk === r.rule_id;
                  return (
                    <Fragment key={r.rule_id}>
                      <TR
                        className="cursor-pointer"
                        onClick={() => setOpenRisk(isOpen ? null : r.rule_id)}
                      >
                        <TD>
                          <div className="font-medium text-foreground">
                            {r.title}
                          </div>
                          <code className="font-mono text-[11px] text-muted-foreground">
                            {r.rule_id}
                          </code>
                        </TD>
                        <TD className="text-muted-foreground">{r.category}</TD>
                        <TD className="text-center">
                          <StatusBadge
                            status={severityToStatus(r.severity)}
                            label={r.severity}
                            size="sm"
                          />
                        </TD>
                        <TD className="text-right tabular-nums">
                          {formatNumber(r.probability, r.probability <= 1 ? 2 : 0)}
                        </TD>
                        <TD className="text-right tabular-nums">
                          {formatNumber(r.impact, r.impact <= 1 ? 2 : 0)}
                        </TD>
                        <TD className="text-right font-medium tabular-nums text-foreground">
                          {formatNumber(r.score, 1)}
                        </TD>
                      </TR>
                      {isOpen ? (
                        <TR className="hover:bg-transparent">
                          <TD colSpan={6} className="bg-surface/40">
                            <div className="space-y-3">
                              <div className="rounded-md border border-border bg-surface px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Recommended action
                                </p>
                                <p className="mt-0.5 text-sm text-foreground/90">
                                  {r.recommended_action}
                                </p>
                              </div>
                              <ExplanationPanel
                                explanation={r.explanation}
                                defaultOpen
                                title={`Why "${r.title}" was flagged`}
                              />
                            </div>
                          </TD>
                        </TR>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
