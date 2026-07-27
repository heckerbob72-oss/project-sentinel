"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Users } from "lucide-react";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TBody, THead, TD, TH, TR, Table } from "@/components/ui/Table";
import { apiGet } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/types";
import { cn, formatPercent } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

interface ResourceAssignment {
  task_id: string;
  task_label?: string;
  member_name: string;
  skill_match: number;
  hours: number;
  reason?: string;
  backup_member_id?: string;
}

interface ResourceResult {
  assignments: ResourceAssignment[];
  utilisation: Record<string, number>;
  overloaded_members: string[];
  unassigned_tasks: string[];
  skill_gaps: string[];
}

export default function ResourcesPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId) ?? "1";
  const projectName = useProjectStore((s) => s.selectedProjectName);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["resources", projectId],
    queryFn: () => apiGet<ResourceResult>(`/projects/${projectId}/resources`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const env = data as ApiEnvelope<ResourceResult> | undefined;
  const r = env?.data;
  const utilisation = r?.utilisation ?? {};
  const assignments = r?.assignments ?? [];

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Users size={20} className="text-sentinel-300" /> Resources
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · assignments, utilisation, and
          contention hotspots.
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <div className="space-y-4">
          <Card className="p-5">
            <Skeleton className="h-40 w-full" />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-56 w-full" />
          </Card>
        </div>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load resources"
          description="The resources API is unavailable. This view populates once the backend is online."
        />
      ) : !r ? (
        <EmptyState title="No resource plan" description="No resource plan is available for this project." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <WarningCard title="Overloaded members" items={r.overloaded_members} />
            <WarningCard title="Unassigned tasks" items={r.unassigned_tasks} />
            <WarningCard title="Skill gaps" items={r.skill_gaps} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Team Utilisation</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(utilisation).length ? (
                <div className="space-y-3">
                  {Object.entries(utilisation).map(([member, ratio]) => {
                    const over = ratio > 1;
                    const width = Math.min(100, Math.round(ratio * 100));
                    return (
                      <div key={member}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">{member}</span>
                          <span
                            className={cn(
                              "tabular-nums",
                              over ? "text-status-red" : "text-muted-foreground",
                            )}
                          >
                            {formatPercent(ratio, 0)}
                            {over ? " · overloaded" : ""}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              over ? "bg-status-red" : "bg-status-green",
                            )}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No utilisation data.</p>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Assignments</CardTitle>
            </CardHeader>
            {assignments.length ? (
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Task</TH>
                    <TH>Member</TH>
                    <TH className="text-right">Skill match</TH>
                    <TH className="text-right">Hours</TH>
                    <TH>Reason</TH>
                  </TR>
                </THead>
                <TBody>
                  {assignments.map((a, i) => (
                    <TR key={`${a.task_id}-${i}`} className="hover:bg-transparent">
                      <TD>
                        <div className="font-medium text-foreground">
                          {a.task_label ?? a.task_id}
                        </div>
                        <code className="font-mono text-[11px] text-muted-foreground">
                          {a.task_id}
                        </code>
                      </TD>
                      <TD className="text-foreground/90">{a.member_name}</TD>
                      <TD className="text-right tabular-nums">
                        {formatPercent(a.skill_match, 0)}
                      </TD>
                      <TD className="text-right tabular-nums">{a.hours}</TD>
                      <TD className="max-w-xs text-xs text-muted-foreground">{a.reason}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <CardContent>
                <p className="text-sm text-muted-foreground">No assignments yet.</p>
              </CardContent>
            )}
          </Card>

          {env?.explanation ? (
            <ExplanationPanel
              explanation={env.explanation}
              title="How this allocation was decided"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function WarningCard({ title, items }: { title: string; items: string[] | undefined }) {
  const list = items ?? [];
  const has = list.length > 0;
  return (
    <Card
      className={cn(
        "p-5",
        has ? "border-status-amber/30 bg-status-amber/5" : undefined,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle
          size={15}
          className={has ? "text-status-amber" : "text-muted-foreground"}
        />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="ml-auto tabular-nums text-xs text-muted-foreground">{list.length}</span>
      </div>
      {has ? (
        <ul className="space-y-1.5">
          {list.map((it, i) => (
            <li key={`${it}-${i}`} className="flex items-start gap-2 text-sm text-foreground/85">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-amber" />
              {it}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-status-green">None — all clear.</p>
      )}
    </Card>
  );
}
