"use client";

import { useQueries } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  Heart,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { NextBestActions } from "@/components/NextBestActions";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCards, SkeletonText } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiGet } from "@/lib/api";
import type {
  ApiEnvelope,
  Health,
  NextAction,
  Risk,
  TimelineResult,
} from "@/lib/types";
import {
  clamp,
  formatPercent,
  scoreToStatus,
  severityToStatus,
  statusColor,
  statusStyle,
} from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

export default function DashboardPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId);
  const projectName = useProjectStore((s) => s.selectedProjectName);

  const results = useQueries({
    queries: [
      {
        queryKey: ["health", projectId],
        queryFn: () => apiGet<Health>(`/projects/${projectId}/health`),
        enabled: Boolean(projectId),
        retry: 0,
      },
      {
        queryKey: ["risks", projectId],
        queryFn: () => apiGet<{ risks: Risk[] }>(`/projects/${projectId}/risks`),
        enabled: Boolean(projectId),
        retry: 0,
      },
      {
        queryKey: ["timeline", projectId],
        queryFn: () => apiGet<TimelineResult>(`/projects/${projectId}/timeline`),
        enabled: Boolean(projectId),
        retry: 0,
      },
    ],
  });

  const [healthQ, risksQ, timelineQ] = results;
  const isLoading = results.some((r) => r.isLoading && r.fetchStatus !== "idle");
  const isError = results.every((r) => r.isError);

  if (!projectId) {
    return (
      <PageShell title="Dashboard">
        <EmptyState
          title="No project selected"
          description="Choose a project from the selector in the top bar, or open the Control Tower to pick one."
          action={
            <Link
              href="/control-tower"
              className="text-sm text-sentinel-300 hover:underline"
            >
              Go to Control Tower →
            </Link>
          }
        />
      </PageShell>
    );
  }

  if (isLoading) {
    return (
      <PageShell title="Dashboard" subtitle={projectName ?? undefined}>
        <SkeletonCards count={4} />
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <SkeletonText lines={6} />
          </Card>
          <Card className="p-5">
            <SkeletonText lines={6} />
          </Card>
        </div>
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell title="Dashboard" subtitle={projectName ?? undefined}>
        <EmptyState
          variant="error"
          title="Sentinel backend unavailable"
          description="We couldn't load live project telemetry. The dashboard will populate once the API is reachable."
        />
      </PageShell>
    );
  }

  const health = (healthQ.data as ApiEnvelope<Health> | undefined)?.data;
  const risks =
    (risksQ.data as ApiEnvelope<{ risks: Risk[] }> | undefined)?.data?.risks ??
    [];
  const timeline = (timelineQ.data as ApiEnvelope<TimelineResult> | undefined)
    ?.data;

  // Aggregate next_actions across whichever envelopes returned them.
  const nextActions: NextAction[] = results.flatMap(
    (r) => (r.data as ApiEnvelope<unknown> | undefined)?.next_actions ?? [],
  );

  const openRisks = risks.length;
  const highRisks = risks.filter((r) =>
    ["high", "critical", "severe"].includes(r.severity?.toLowerCase()),
  ).length;

  // Frontend-derived success probability: health tempered by feasibility + risk.
  const successProb = health
    ? clamp(
        Math.round(
          health.overall * (timeline?.deadline_feasible === false ? 0.82 : 1) -
            highRisks * 4,
        ),
        0,
        100,
      )
    : undefined;

  const dimensionData = (health?.dimensions ?? [])
    .slice()
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 6)
    .map((d) => ({
      name: d.name.replace(/_/g, " "),
      value: Number(d.score.toFixed(1)),
    }));

  const severityBuckets = ["low", "medium", "high", "critical"].map((sev) => ({
    name: sev,
    value: risks.filter((r) => severityToStatus(r.severity) === severityToStatus(sev)).length,
    color: statusColor(severityToStatus(sev)),
  }));

  return (
    <PageShell title="Dashboard" subtitle={projectName ?? undefined}>
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Project Health"
          value={health ? Math.round(health.overall) : "—"}
          icon={<Heart size={16} />}
          accent={
            health
              ? statusStyle(health.status ?? scoreToStatus(health.overall)).text
              : undefined
          }
          hint={
            health ? (
              <StatusBadge status={health.status ?? scoreToStatus(health.overall)} />
            ) : (
              "No health data"
            )
          }
        />
        <StatCard
          label="Open Risks"
          value={openRisks}
          icon={<AlertTriangle size={16} />}
          hint={`${highRisks} high / critical`}
        />
        <StatCard
          label="Success Probability"
          value={successProb !== undefined ? formatPercent(successProb) : "—"}
          icon={<TrendingUp size={16} />}
          hint="Model-derived from health + risk"
        />
        <StatCard
          label="Timeline"
          value={
            timeline ? `${Math.round(timeline.project_duration)}d` : "—"
          }
          icon={<CalendarClock size={16} />}
          hint={
            timeline ? (
              <span
                className={
                  timeline.deadline_feasible
                    ? "text-status-green"
                    : "text-status-red"
                }
              >
                {timeline.deadline_feasible ? "Deadline feasible" : "Deadline at risk"}
              </span>
            ) : (
              "No schedule"
            )
          }
        />
      </div>

      {/* Rescue banner */}
      {health?.rescue_recommended ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-status-critical/40 bg-status-critical/10 px-4 py-3">
          <AlertTriangle size={18} className="text-status-critical" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-status-critical">
              Rescue recommended.
            </span>{" "}
            <span className="text-foreground/80">
              Health has dropped into rescue territory. Review recovery options.
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

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Next best actions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle icon={<Activity size={15} className="text-sentinel-300" />}>
              Next Best Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NextBestActions actions={nextActions} />
          </CardContent>
        </Card>

        {/* Top drivers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Health Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            {health?.top_drivers?.length ? (
              <ul className="space-y-2">
                {health.top_drivers.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface-overlay text-[10px] text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-foreground/85">{d}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No drivers reported.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mini charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Health by Dimension</CardTitle>
          </CardHeader>
          <CardContent>
            {dimensionData.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={dimensionData}
                  layout="vertical"
                  margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                >
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: "hsl(218 12% 60%)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fill: "hsl(218 12% 60%)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(222 24% 15% / 0.5)" }}
                    contentStyle={{
                      background: "hsl(222 26% 12%)",
                      border: "1px solid hsl(220 18% 24%)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {dimensionData.map((d, i) => (
                      <Cell key={i} fill={statusColor(scoreToStatus(d.value))} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No dimension data.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {openRisks ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={severityBuckets}
                  margin={{ left: 0, right: 8, top: 8, bottom: 4 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "hsl(218 12% 60%)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => v[0].toUpperCase() + v.slice(1)}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "hsl(218 12% 60%)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(222 24% 15% / 0.5)" }}
                    contentStyle={{
                      background: "hsl(222 26% 12%)",
                      border: "1px solid hsl(220 18% 24%)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {severityBuckets.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                No open risks — nothing to plot.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
