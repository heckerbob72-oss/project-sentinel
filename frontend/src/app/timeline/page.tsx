"use client";

import { useQuery } from "@tanstack/react-query";
import { Waypoints } from "lucide-react";
import Link from "next/link";

import { GanttChart } from "@/components/GanttChart";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TBody, THead, TD, TH, TR, Table } from "@/components/ui/Table";
import { apiGetData } from "@/lib/api";
import type { TimelineResult } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

export default function TimelinePage() {
  const projectId = useProjectStore((s) => s.selectedProjectId);
  const projectName = useProjectStore((s) => s.selectedProjectName);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["timeline", projectId],
    queryFn: () => apiGetData<TimelineResult>(`/projects/${projectId}/timeline`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  if (!projectId) {
    return (
      <div>
        <h1 className="mb-5 text-xl font-semibold text-foreground">Timeline</h1>
        <EmptyState
          title="No project selected"
          description="Pick a project from the top bar to view its critical-path schedule."
          action={
            <Link href="/control-tower" className="text-sm text-sentinel-300 hover:underline">
              Go to Control Tower →
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Waypoints size={20} className="text-sentinel-300" /> Timeline
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · critical path method schedule
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <Card className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </Card>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load the timeline"
          description="The scheduling API is unavailable. This view populates once the backend is online."
        />
      ) : !data ? (
        <EmptyState title="No schedule" description="No timeline is available for this project." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Project Duration"
              value={`${formatNumber(data.project_duration, 1)}d`}
            />
            <StatCard
              label="Deadline"
              value={data.deadline_feasible ? "Feasible" : "At risk"}
              accent={data.deadline_feasible ? "text-status-green" : "text-status-red"}
            />
            <StatCard
              label="Critical Path"
              value={`${data.critical_path.length} tasks`}
            />
          </div>

          {data.critical_path.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Critical Path</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-1.5">
                {data.critical_path.map((id, i) => (
                  <span key={id} className="flex items-center gap-1.5">
                    <code className="rounded-md border border-status-red/30 bg-status-red/10 px-2 py-0.5 font-mono text-xs text-status-red">
                      {id}
                    </code>
                    {i < data.critical_path.length - 1 ? (
                      <span className="text-muted-foreground">→</span>
                    ) : null}
                  </span>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Schedule (Gantt)</CardTitle>
            </CardHeader>
            <CardContent>
              <GanttChart bars={data.gantt} projectDuration={data.project_duration} />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Task Schedule</CardTitle>
            </CardHeader>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Task</TH>
                  <TH className="text-right">Duration</TH>
                  <TH className="text-right">Earliest Start</TH>
                  <TH className="text-right">Earliest Finish</TH>
                  <TH className="text-right">Float</TH>
                  <TH className="text-center">Critical</TH>
                </TR>
              </THead>
              <TBody>
                {data.tasks.map((t) => (
                  <TR key={t.id}>
                    <TD>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {t.id}
                      </span>{" "}
                      <span className="font-medium text-foreground">{t.label}</span>
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatNumber(t.duration, 1)}
                    </TD>
                    <TD className="text-right tabular-nums text-muted-foreground">
                      {formatNumber(t.earliest_start, 1)}
                    </TD>
                    <TD className="text-right tabular-nums text-muted-foreground">
                      {formatNumber(t.earliest_finish, 1)}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatNumber(t.total_float, 1)}
                    </TD>
                    <TD className="text-center">
                      {t.is_critical ? (
                        <StatusBadge status="red" label="Critical" size="sm" showDot={false} />
                      ) : (
                        <Badge variant="muted">slack</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
