"use client";

import { useQuery } from "@tanstack/react-query";
import { Radar } from "lucide-react";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TBody, THead, TD, TH, TR, Table } from "@/components/ui/Table";
import { apiGet } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/types";
import { cn, scoreToStatus, severityToStatus, statusStyle } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

interface Gap {
  field: string;
  importance: string;
  question: string;
  expected_answer_type?: string;
  affected_modules?: string[];
}

interface GapResult {
  gaps: Gap[];
  completeness: number;
}

const IMPORTANCE_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function GapAnalysisPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId) ?? "1";
  const projectName = useProjectStore((s) => s.selectedProjectName);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["gaps", projectId],
    queryFn: () => apiGet<GapResult>(`/projects/${projectId}/gaps`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const env = data as ApiEnvelope<GapResult> | undefined;
  const result = env?.data;
  const gaps = result?.gaps ?? [];
  const sorted = [...gaps].sort(
    (a, b) =>
      (IMPORTANCE_ORDER[a.importance?.toLowerCase()] ?? 9) -
      (IMPORTANCE_ORDER[b.importance?.toLowerCase()] ?? 9),
  );
  const completeness = result ? Math.round(result.completeness <= 1 ? result.completeness * 100 : result.completeness) : 0;
  const completenessStatus = scoreToStatus(completeness);

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Radar size={20} className="text-sentinel-300" /> Gap Analysis
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · outstanding information the brief
          still needs.
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <div className="space-y-4">
          <Card className="p-5">
            <Skeleton className="h-10 w-full" />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-56 w-full" />
          </Card>
        </div>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load gap analysis"
          description="The gap-analysis API is unavailable. This view populates once the backend is online."
        />
      ) : !result ? (
        <EmptyState title="No gap analysis" description="No gap analysis is available for this project." />
      ) : (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="stat-label">Brief completeness</span>
              <StatusBadge status={completenessStatus} label={`${completeness}%`} />
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-overlay">
              <div
                className={cn("h-full rounded-full transition-all", statusStyle(completenessStatus).dot)}
                style={{ width: `${completeness}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {gaps.length} open {gaps.length === 1 ? "gap" : "gaps"} to close.
            </p>
          </Card>

          {gaps.length ? (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Outstanding Gaps</CardTitle>
              </CardHeader>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Field</TH>
                    <TH className="text-center">Importance</TH>
                    <TH>Follow-up question</TH>
                    <TH>Affected modules</TH>
                  </TR>
                </THead>
                <TBody>
                  {sorted.map((g, i) => (
                    <TR key={`${g.field}-${i}`} className="hover:bg-transparent">
                      <TD>
                        <div className="font-medium capitalize text-foreground">
                          {g.field?.replace(/_/g, " ")}
                        </div>
                        {g.expected_answer_type ? (
                          <code className="font-mono text-[11px] text-muted-foreground">
                            {g.expected_answer_type}
                          </code>
                        ) : null}
                      </TD>
                      <TD className="text-center">
                        <StatusBadge
                          status={severityToStatus(g.importance)}
                          label={g.importance}
                          size="sm"
                        />
                      </TD>
                      <TD className="max-w-md text-sm text-foreground/90">{g.question}</TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {(g.affected_modules ?? []).map((m) => (
                            <Badge key={m} variant="muted">
                              {m}
                            </Badge>
                          ))}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          ) : (
            <EmptyState
              title="No gaps outstanding"
              description="The brief is complete — every required field has been answered."
            />
          )}

          {env?.explanation ? (
            <ExplanationPanel
              explanation={env.explanation}
              title="How these gaps were identified"
              defaultOpen
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
