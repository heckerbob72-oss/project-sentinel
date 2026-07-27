"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Heart, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { HealthGauge } from "@/components/HealthGauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiGetData } from "@/lib/api";
import type { Health } from "@/lib/types";
import { cn, formatNumber, formatPercent, scoreToStatus, statusStyle } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

export default function HealthPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId);
  const projectName = useProjectStore((s) => s.selectedProjectName);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["health", projectId],
    queryFn: () => apiGetData<Health>(`/projects/${projectId}/health`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  if (!projectId) {
    return (
      <div>
        <h1 className="mb-5 text-xl font-semibold text-foreground">
          Project Health
        </h1>
        <EmptyState
          title="No project selected"
          description="Pick a project from the top bar to view its health breakdown."
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
          <Heart size={20} className="text-sentinel-300" /> Project Health
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · weighted, explainable score
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-6">
            <Skeleton className="mx-auto h-48 w-48 rounded-full" />
          </Card>
          <Card className="p-6 lg:col-span-2">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </Card>
        </div>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load health"
          description="The health API is unavailable. This view populates once the backend is online."
        />
      ) : !data ? (
        <EmptyState title="No health data" description="No health score is available for this project." />
      ) : (
        <div className="space-y-4">
          {data.rescue_recommended ? (
            <div className="flex items-center gap-3 rounded-lg border border-status-critical/40 bg-status-critical/10 px-4 py-3">
              <ShieldAlert size={18} className="text-status-critical" />
              <div className="flex-1 text-sm">
                <span className="font-semibold text-status-critical">
                  Rescue recommended.
                </span>{" "}
                <span className="text-foreground/80">
                  Overall health is below the rescue threshold. Consider a formal
                  recovery plan.
                </span>
              </div>
              <Link
                href="/rescue"
                className="text-xs font-medium text-status-critical hover:underline"
              >
                Open Rescue →
              </Link>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="flex flex-col items-center justify-center p-6">
              <HealthGauge
                value={data.overall}
                status={data.status ?? scoreToStatus(data.overall)}
              />
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Weighted across {data.dimensions.length} dimensions
              </p>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Dimension Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...data.dimensions]
                  .sort((a, b) => b.contribution - a.contribution)
                  .map((d) => {
                    const band = scoreToStatus(d.score);
                    const style = statusStyle(band);
                    return (
                      <div key={d.name}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium capitalize text-foreground">
                            {d.name.replace(/_/g, " ")}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {formatNumber(d.score, 1)} ·{" "}
                            {formatPercent(d.weight, 0)} wt ·{" "}
                            <span className={style.text}>
                              {formatNumber(d.contribution, 1)} pts
                            </span>
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
                          <div
                            className={cn("h-full rounded-full", style.dot)}
                            style={{ width: `${Math.min(100, d.score)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {d.rationale}
                        </p>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle icon={<AlertTriangle size={15} className="text-status-amber" />}>
                  Top Drivers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.top_drivers?.length ? (
                  <ul className="space-y-2">
                    {data.top_drivers.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface-overlay text-[10px] text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="text-foreground/85">{d}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No dominant drivers.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              <ExplanationPanel
                explanation={data.explanation}
                title="How this health score was computed"
                defaultOpen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
