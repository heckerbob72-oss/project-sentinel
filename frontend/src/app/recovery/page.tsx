"use client";

import { useQuery } from "@tanstack/react-query";
import { LifeBuoy, ShieldCheck, TrendingDown } from "lucide-react";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TBody, THead, TD, TH, TR, Table } from "@/components/ui/Table";
import { apiGet } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/types";
import { formatNumber, severityToStatus } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

interface RecoveryAction {
  risk: string;
  action: string;
  expected_risk_reduction_pct: number;
  owner?: string;
  urgency: string;
}

interface RecoveryResult {
  actions: RecoveryAction[];
  estimated_total_reduction_pct: number;
  approval_status: string;
}

export default function RecoveryPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId) ?? "1";
  const projectName = useProjectStore((s) => s.selectedProjectName);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["recovery", projectId],
    queryFn: () => apiGet<RecoveryResult>(`/projects/${projectId}/recovery`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const env = data as ApiEnvelope<RecoveryResult> | undefined;
  const r = env?.data;
  const actions = r?.actions ?? [];
  const needsApproval =
    (r?.approval_status ?? "").toLowerCase() === "suggested" ||
    (r?.approval_status ?? "").toLowerCase().includes("pending");

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <LifeBuoy size={20} className="text-sentinel-300" /> Recovery
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · a costed recovery plan with
          expected risk reduction.
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <div className="space-y-4">
          <Card className="p-5">
            <Skeleton className="h-16 w-full" />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-56 w-full" />
          </Card>
        </div>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load recovery plan"
          description="The recovery API is unavailable. This view populates once the backend is online."
        />
      ) : !r ? (
        <EmptyState title="No recovery plan" description="No recovery plan is available for this project." />
      ) : (
        <div className="space-y-4">
          {r.approval_status ? (
            <div
              className={
                needsApproval
                  ? "flex items-center gap-3 rounded-lg border border-status-amber/40 bg-status-amber/10 px-4 py-3"
                  : "flex items-center gap-3 rounded-lg border border-status-green/40 bg-status-green/10 px-4 py-3"
              }
            >
              <ShieldCheck
                size={18}
                className={needsApproval ? "text-status-amber" : "text-status-green"}
              />
              <div className="flex-1 text-sm">
                <span
                  className={
                    needsApproval
                      ? "font-semibold text-status-amber"
                      : "font-semibold text-status-green"
                  }
                >
                  {needsApproval ? "Needs human approval." : "Approved."}
                </span>{" "}
                <span className="text-foreground/80">
                  Approval status:{" "}
                  <span className="capitalize">{r.approval_status}</span>.
                  {needsApproval
                    ? " Review the actions below before committing the plan."
                    : ""}
                </span>
              </div>
            </div>
          ) : null}

          <Card className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-green/15 text-status-green">
                <TrendingDown size={18} />
              </span>
              <div>
                <p className="stat-label">Estimated total risk reduction</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-status-green">
                  {formatNumber(r.estimated_total_reduction_pct, 0)}%
                </p>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              across {actions.length} {actions.length === 1 ? "action" : "actions"}
            </span>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Recovery Actions</CardTitle>
            </CardHeader>
            {actions.length ? (
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Risk</TH>
                    <TH>Action</TH>
                    <TH className="text-center">Urgency</TH>
                    <TH>Owner</TH>
                    <TH className="text-right">Expected reduction</TH>
                  </TR>
                </THead>
                <TBody>
                  {actions.map((a, i) => (
                    <TR key={i} className="hover:bg-transparent">
                      <TD className="text-foreground/90">{a.risk}</TD>
                      <TD className="max-w-sm text-foreground/90">{a.action}</TD>
                      <TD className="text-center">
                        <StatusBadge
                          status={severityToStatus(a.urgency)}
                          label={a.urgency}
                          size="sm"
                        />
                      </TD>
                      <TD className="text-muted-foreground">{a.owner ?? "—"}</TD>
                      <TD className="text-right">
                        <Badge variant="success">
                          −{formatNumber(a.expected_risk_reduction_pct, 0)}%
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <CardContent>
                <p className="text-sm text-muted-foreground">No recovery actions proposed.</p>
              </CardContent>
            )}
          </Card>

          {env?.explanation ? (
            <ExplanationPanel
              explanation={env.explanation}
              title="How this recovery plan was built"
              defaultOpen
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
