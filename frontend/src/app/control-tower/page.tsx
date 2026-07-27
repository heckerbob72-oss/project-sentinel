"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { Grid3x3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge, StatusDot } from "@/components/ui/StatusBadge";
import { TBody, THead, TD, TH, TR, Table } from "@/components/ui/Table";
import { apiGetData } from "@/lib/api";
import type { Health, Project, StatusColor } from "@/lib/types";
import { cn, scoreToStatus } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

type Filter = "all" | StatusColor;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "green", label: "Green" },
  { key: "amber", label: "Amber" },
  { key: "red", label: "Red" },
  { key: "critical", label: "Critical" },
];

/** Derive the traffic-light status for a project from its live health snapshot. */
function overallStatus(health: Health | undefined): StatusColor | undefined {
  if (!health) return undefined;
  return health.status ?? scoreToStatus(health.overall);
}

export default function ControlTowerPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const setSelectedProject = useProjectStore((s) => s.setSelectedProject);
  const router = useRouter();

  const {
    data: projects,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiGetData<Project[]>("/projects"),
    retry: 0,
  });

  // Fetch every project's live health once here (rather than per-row) so the
  // status filters above have real data to filter against instead of the
  // (never-populated) Project.health_status/health_score fields.
  const healthQueries = useQueries({
    queries: (projects ?? []).map((p) => ({
      queryKey: ["health", p.id],
      queryFn: () => apiGetData<Health>(`/projects/${p.id}/health`),
      retry: 0,
      staleTime: 60_000,
      enabled: Boolean(projects),
    })),
  });

  const healthByProjectId = useMemo(() => {
    const map = new Map<string, { health?: Health; isLoading: boolean }>();
    (projects ?? []).forEach((p, i) => {
      map.set(String(p.id), {
        health: healthQueries[i]?.data,
        isLoading: healthQueries[i]?.isLoading ?? false,
      });
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, healthQueries.map((q) => q.dataUpdatedAt).join(",")]);

  const filtered = useMemo(() => {
    if (!projects) return [];
    if (filter === "all") return projects;
    return projects.filter((p) => {
      const status = overallStatus(healthByProjectId.get(String(p.id))?.health);
      return status === filter;
    });
  }, [projects, filter, healthByProjectId]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <Grid3x3 size={20} className="text-sentinel-300" /> Control Tower
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Portfolio-wide traffic-light view across schedule, risk, workload and
            delivery.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-sentinel-500/50 bg-sentinel-600/15 text-sentinel-200"
                  : "border-border text-muted-foreground hover:bg-surface-overlay hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            variant="error"
            title="Couldn't load the portfolio"
            description="The projects API is not reachable right now. This view will populate once the backend is online."
          />
        ) : !filtered.length ? (
          <EmptyState
            title={projects?.length ? "No projects match this filter" : "No projects yet"}
            description={
              projects?.length
                ? "Try a different status filter."
                : "Projects created through Intake will appear here."
            }
          />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Project</TH>
                <TH className="text-center">Health</TH>
                <TH className="text-center">Schedule</TH>
                <TH className="text-center">Risk</TH>
                <TH className="text-center">Workload</TH>
                <TH className="text-center">Delivery</TH>
                <TH className="text-right">Intake</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  health={healthByProjectId.get(String(p.id))?.health}
                  isLoading={healthByProjectId.get(String(p.id))?.isLoading ?? false}
                  onOpen={() => {
                    setSelectedProject(p.id, p.name);
                    router.push("/dashboard");
                  }}
                />
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}

/** A row that renders the project's traffic-light columns from its live health snapshot. */
function ProjectRow({
  project,
  health,
  isLoading,
  onOpen,
}: {
  project: Project;
  health: Health | undefined;
  isLoading: boolean;
  onOpen: () => void;
}) {
  const dim = (names: string[]): StatusColor | undefined => {
    if (!health) return undefined;
    const d = health.dimensions.find((x) =>
      names.includes(x.name.toLowerCase()),
    );
    return d ? scoreToStatus(d.score) : undefined;
  };

  const overall = overallStatus(health);

  const cell = (status: StatusColor | undefined) => (
    <TD className="text-center">
      {isLoading && !status ? (
        <span className="mx-auto block h-2.5 w-2.5 animate-pulse rounded-full bg-surface-overlay" />
      ) : status ? (
        <StatusDot status={status} className="mx-auto" />
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </TD>
  );

  return (
    <TR className="cursor-pointer" onClick={onOpen}>
      <TD>
        <div className="font-medium text-foreground">{project.name}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {project.methodology ? (
            <Badge variant="muted">{project.methodology}</Badge>
          ) : null}
          {project.status ? <span className="capitalize">{project.status}</span> : null}
        </div>
      </TD>
      <TD className="text-center">
        {isLoading && !overall ? (
          <span className="mx-auto block h-2.5 w-2.5 animate-pulse rounded-full bg-surface-overlay" />
        ) : overall ? (
          <StatusBadge status={overall} size="sm" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TD>
      {cell(dim(["schedule"]))}
      {cell(dim(["risk"]))}
      {cell(dim(["workload", "resource"]))}
      {cell(dim(["delivery_readiness", "demo_readiness", "testing_readiness"]))}
      <TD className="text-right tabular-nums text-muted-foreground">
        {project.intake_completeness !== undefined
          ? `${Math.round(
              project.intake_completeness <= 1
                ? project.intake_completeness * 100
                : project.intake_completeness,
            )}%`
          : "—"}
      </TD>
    </TR>
  );
}
