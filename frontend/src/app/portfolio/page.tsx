"use client";

import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, LifeBuoy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiGetData } from "@/lib/api";
import { cn, formatPercent, scoreToStatus, severityToStatus, statusStyle } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

interface PortfolioItem {
  project_id: string | number;
  name: string;
  health: number;
  risk_level: string;
  progress: number;
  delivery_confidence: number;
  rescue_mode: string;
  next_milestone?: string;
}

/** Normalise a 0..1 or 0..100 input to a 0..100 percentage. */
function pct(value: number | undefined | null): number {
  if (value === undefined || value === null || Number.isNaN(value)) return 0;
  return Math.round(value <= 1 ? value * 100 : value);
}

export default function PortfolioPage() {
  const setSelectedProject = useProjectStore((s) => s.setSelectedProject);
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => apiGetData<PortfolioItem[]>("/portfolio"),
    retry: 0,
  });

  const projects = useMemo(() => data ?? [], [data]);

  const riskLevels = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) if (p.risk_level) set.add(p.risk_level.toLowerCase());
    return Array.from(set);
  }, [projects]);

  const filtered =
    filter === "all"
      ? projects
      : projects.filter((p) => (p.risk_level ?? "").toLowerCase() === filter);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <LayoutGrid size={20} className="text-sentinel-300" /> Portfolio
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Cross-project health, delivery confidence, and rescue posture.
          </p>
        </div>
        {riskLevels.length ? (
          <div className="flex flex-wrap gap-1.5">
            {["all", ...riskLevels].map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                  filter === key
                    ? "border-sentinel-500/50 bg-sentinel-600/15 text-sentinel-200"
                    : "border-border text-muted-foreground hover:bg-surface-overlay hover:text-foreground",
                )}
              >
                {key === "all" ? "All" : key}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-32 w-full" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load the portfolio"
          description="The portfolio API is unavailable. This view populates once the backend is online."
        />
      ) : !filtered.length ? (
        <EmptyState
          title={projects.length ? "No projects match this filter" : "No projects yet"}
          description={
            projects.length
              ? "Try a different risk-level filter."
              : "Projects created through Intake will appear here."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const health = pct(p.health);
            const status = scoreToStatus(health);
            const progress = pct(p.progress);
            const rescue = (p.rescue_mode ?? "").toLowerCase() === "active";
            return (
              <Card
                key={String(p.project_id)}
                className="cursor-pointer p-5 transition-colors hover:border-sentinel-500/40"
                onClick={() => {
                  setSelectedProject(String(p.project_id), p.name);
                  router.push("/dashboard");
                }}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-foreground">{p.name}</h3>
                    {p.risk_level ? (
                      <StatusBadge
                        status={severityToStatus(p.risk_level)}
                        label={`${p.risk_level} risk`}
                        size="sm"
                        className="mt-1"
                      />
                    ) : null}
                  </div>
                  {rescue ? (
                    <Badge variant="danger" className="shrink-0">
                      <LifeBuoy size={11} /> Rescue
                    </Badge>
                  ) : null}
                </div>

                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="stat-label">Health</p>
                    <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
                      {health}
                    </p>
                  </div>
                  <StatusBadge status={status} />
                </div>

                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
                  <div
                    className={cn("h-full rounded-full", statusStyle(status).dot)}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Delivery confidence</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatPercent(p.delivery_confidence, 0)}
                  </span>
                </div>

                {p.next_milestone ? (
                  <p className="mt-3 truncate border-t border-border pt-3 text-xs text-muted-foreground">
                    Next: <span className="text-foreground/80">{p.next_milestone}</span>
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
