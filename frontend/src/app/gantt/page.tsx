"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import Link from "next/link";

import { GanttChart } from "@/components/GanttChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiGetData } from "@/lib/api";
import type { TimelineResult } from "@/lib/types";
import { useProjectStore } from "@/store/useProjectStore";

export default function GanttPage() {
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
        <h1 className="mb-5 text-xl font-semibold text-foreground">Gantt</h1>
        <EmptyState
          title="No project selected"
          description="Pick a project from the top bar to view its Gantt chart."
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
          <BarChart3 size={20} className="text-sentinel-300" /> Gantt
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · schedule bars with the critical
          path highlighted
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <Card className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </Card>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load the Gantt"
          description="The scheduling API is unavailable. This view populates once the backend is online."
        />
      ) : !data?.gantt?.length ? (
        <EmptyState title="No schedule" description="No Gantt bars are available for this project." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <GanttChart bars={data.gantt} projectDuration={data.project_duration} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
