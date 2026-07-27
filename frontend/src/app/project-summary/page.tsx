"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileText, Heart, TrendingUp } from "lucide-react";
import Link from "next/link";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { NextBestActions } from "@/components/NextBestActions";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiGet } from "@/lib/api";
import type { ApiEnvelope, StatusColor } from "@/lib/types";
import { formatPercent, scoreToStatus, statusStyle } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

interface SummaryHealth {
  overall: number;
  status?: StatusColor | string;
  rescue_recommended?: boolean;
}

type TopRisk =
  | string
  | { title?: string; label?: string; severity?: string; score?: number };

interface ProjectSummary {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: Record<string, any>;
  health: SummaryHealth;
  success_probability: number;
  top_risks: TopRisk[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metrics: Record<string, any>;
}

function riskTitle(r: TopRisk): string {
  if (typeof r === "string") return r;
  return r.title ?? r.label ?? "Risk";
}

function metricValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function ProjectSummaryPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId) ?? "1";
  const projectName = useProjectStore((s) => s.selectedProjectName);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["project-summary", projectId],
    queryFn: () => apiGet<ProjectSummary>(`/projects/${projectId}/summary`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const env = data as ApiEnvelope<ProjectSummary> | undefined;
  const summary = env?.data;

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <FileText size={20} className="text-sentinel-300" /> Project Summary
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · a one-glance briefing of health,
          delivery odds, and top risks.
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-16 w-full" />
              </Card>
            ))}
          </div>
          <Card className="p-5">
            <Skeleton className="h-40 w-full" />
          </Card>
        </div>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load the summary"
          description="The summary API is unavailable. This view populates once the backend is online."
        />
      ) : !summary ? (
        <EmptyState title="No summary" description="No summary is available for this project." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Project Health"
              value={Math.round(summary.health?.overall ?? 0)}
              icon={<Heart size={16} />}
              accent={
                statusStyle(
                  summary.health?.status ?? scoreToStatus(summary.health?.overall ?? 0),
                ).text
              }
              hint={
                <StatusBadge
                  status={summary.health?.status ?? scoreToStatus(summary.health?.overall ?? 0)}
                />
              }
            />
            <StatCard
              label="Success Probability"
              value={formatPercent(summary.success_probability, 0)}
              icon={<TrendingUp size={16} />}
              hint="Likelihood of on-target delivery"
            />
            <StatCard
              label="Status"
              value={
                <span className="capitalize">
                  {String(summary.health?.status ?? scoreToStatus(summary.health?.overall ?? 0))}
                </span>
              }
              icon={<AlertTriangle size={16} />}
              hint={summary.health?.rescue_recommended ? "Rescue recommended" : "Within tolerance"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle icon={<AlertTriangle size={15} className="text-status-amber" />}>
                  Top Risks
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.top_risks?.length ? (
                  <ul className="space-y-2">
                    {summary.top_risks.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2"
                      >
                        <span className="min-w-0 truncate text-sm text-foreground/90">
                          {riskTitle(r)}
                        </span>
                        {typeof r === "object" && r.severity ? (
                          <StatusBadge status={r.severity} label={r.severity} size="sm" />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-status-green">No significant risks flagged.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.metrics && Object.keys(summary.metrics).length ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(summary.metrics).map(([k, v]) => (
                      <div key={k} className="rounded-md border border-border bg-surface px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {k.replace(/_/g, " ")}
                        </p>
                        <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                          {metricValue(v)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No metrics reported.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {env?.next_actions?.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Next Best Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <NextBestActions actions={env.next_actions} />
              </CardContent>
            </Card>
          ) : null}

          {env?.explanation ? (
            <ExplanationPanel
              explanation={env.explanation}
              title="How this summary was assembled"
            />
          ) : null}

          <p className="text-center text-xs text-muted-foreground">
            Need the deep dive?{" "}
            <Link href="/health" className="text-sentinel-300 hover:underline">
              Open full health breakdown →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
