"use client";

import { useQueries } from "@tanstack/react-query";
import { GitFork, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { DependencyGraph } from "@/components/DependencyGraph";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiGetData } from "@/lib/api";
import type { DependencyGraphResult, TimelineResult } from "@/lib/types";
import { useProjectStore } from "@/store/useProjectStore";

export default function DependenciesPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId);
  const projectName = useProjectStore((s) => s.selectedProjectName);

  const [depQ, timeQ] = useQueries({
    queries: [
      {
        queryKey: ["dependencies", projectId],
        queryFn: () =>
          apiGetData<DependencyGraphResult>(`/projects/${projectId}/dependencies`),
        enabled: Boolean(projectId),
        retry: 0,
      },
      {
        queryKey: ["timeline", projectId],
        queryFn: () => apiGetData<TimelineResult>(`/projects/${projectId}/timeline`),
        enabled: Boolean(projectId),
        retry: 0,
      },
    ],
  });

  const dep = depQ.data;
  const timeline = timeQ.data;

  const criticalIds = useMemo(() => {
    const set = new Set<string>();
    (timeline?.critical_path ?? []).forEach((id) => set.add(id));
    (dep?.single_points_of_failure ?? []).forEach((id) => set.add(id));
    return [...set];
  }, [dep, timeline]);

  if (!projectId) {
    return (
      <div>
        <h1 className="mb-5 text-xl font-semibold text-foreground">Dependencies</h1>
        <EmptyState
          title="No project selected"
          description="Pick a project from the top bar to view its dependency graph."
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
          <GitFork size={20} className="text-sentinel-300" /> Dependencies
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · task graph with critical nodes and
          single points of failure highlighted
        </p>
      </div>

      {depQ.isLoading && depQ.fetchStatus !== "idle" ? (
        <Card className="p-4">
          <Skeleton className="h-[420px] w-full" />
        </Card>
      ) : depQ.isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load dependencies"
          description="The dependency API is unavailable. This view populates once the backend is online."
        />
      ) : !dep?.nodes?.length ? (
        <EmptyState
          title="No dependencies"
          description="No task dependency graph is available for this project."
        />
      ) : (
        <div className="space-y-4">
          {dep.cycle?.has_cycle ? (
            <div className="flex items-center gap-3 rounded-lg border border-status-red/40 bg-status-red/10 px-4 py-3">
              <TriangleAlert size={18} className="text-status-red" />
              <div className="text-sm">
                <span className="font-semibold text-status-red">
                  Cycle detected.
                </span>{" "}
                <span className="text-foreground/80">
                  {dep.cycle.cycle_path.join(" → ")}
                </span>
              </div>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Dependency Graph</CardTitle>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-status-red/60" /> critical
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <DependencyGraph
                nodes={dep.nodes}
                edges={dep.edges}
                criticalIds={criticalIds}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Single Points of Failure</CardTitle>
                <Badge variant={dep.single_points_of_failure?.length ? "danger" : "success"}>
                  {dep.single_points_of_failure?.length ?? 0}
                </Badge>
              </CardHeader>
              <CardContent>
                {dep.single_points_of_failure?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {dep.single_points_of_failure.map((id) => (
                      <code
                        key={id}
                        className="rounded-md border border-status-red/30 bg-status-red/10 px-2 py-0.5 font-mono text-xs text-status-red"
                      >
                        {id}
                      </code>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-status-green">
                    No single points of failure detected.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bottlenecks</CardTitle>
                <Badge variant="muted">{dep.bottlenecks?.length ?? 0}</Badge>
              </CardHeader>
              <CardContent>
                {dep.bottlenecks?.length ? (
                  <ul className="space-y-1.5 text-sm">
                    {dep.bottlenecks.map((b, i) => (
                      <li
                        key={i}
                        className="rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-xs text-muted-foreground"
                      >
                        {JSON.stringify(b)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No bottlenecks flagged.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {dep.explanation ? (
            <ExplanationPanel
              explanation={dep.explanation}
              title="How this dependency graph was analysed"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
