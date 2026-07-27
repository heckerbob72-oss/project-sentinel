"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ListChecks, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { HealthGauge } from "@/components/HealthGauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiGet } from "@/lib/api";
import type { ApiEnvelope, StatusColor } from "@/lib/types";
import { scoreToStatus } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

interface RescueHealth {
  overall: number;
  status?: StatusColor | string;
}

interface RescueResult {
  active: boolean;
  criteria_met: string[];
  top_critical_issues: string[];
  immediate_actions: string[];
  health: RescueHealth;
}

export default function RescuePage() {
  const projectId = useProjectStore((s) => s.selectedProjectId) ?? "1";
  const projectName = useProjectStore((s) => s.selectedProjectName);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["rescue", projectId],
    queryFn: () => apiGet<RescueResult>(`/projects/${projectId}/rescue`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const env = data as ApiEnvelope<RescueResult> | undefined;
  const r = env?.data;

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <ShieldAlert size={20} className="text-sentinel-300" /> Rescue Mode
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · the war room for projects in
          distress.
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <div className="space-y-4">
          <Card className="p-5">
            <Skeleton className="h-16 w-full" />
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-40 w-full" />
              </Card>
            ))}
          </div>
        </div>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load rescue status"
          description="The rescue API is unavailable. This view populates once the backend is online."
        />
      ) : !r ? (
        <EmptyState title="No rescue data" description="No rescue assessment is available for this project." />
      ) : r.active ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-status-critical/50 bg-status-critical/15 px-5 py-4">
            <ShieldAlert size={22} className="text-status-critical" />
            <div>
              <p className="text-base font-bold uppercase tracking-wide text-status-critical">
                Rescue Mode Active
              </p>
              <p className="text-sm text-foreground/80">
                This project has tripped the rescue threshold. Execute the
                immediate actions below.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ListCard
              icon={<ShieldAlert size={15} className="text-status-critical" />}
              title="Criteria met"
              items={r.criteria_met}
              dotClass="bg-status-critical"
            />
            <ListCard
              icon={<ShieldAlert size={15} className="text-status-red" />}
              title="Top critical issues"
              items={r.top_critical_issues}
              dotClass="bg-status-red"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle icon={<ListChecks size={15} className="text-sentinel-300" />}>
                Immediate Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {r.immediate_actions?.length ? (
                <ul className="space-y-2">
                  {r.immediate_actions.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-[10px] text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="text-sm text-foreground/90">{a}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No immediate actions listed.</p>
              )}
            </CardContent>
          </Card>

          {env?.explanation ? (
            <ExplanationPanel
              explanation={env.explanation}
              title="Why rescue mode was triggered"
              defaultOpen
            />
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-status-green/40 bg-status-green/10 px-5 py-4">
            <ShieldCheck size={22} className="text-status-green" />
            <div>
              <p className="text-base font-semibold text-status-green">
                Project not in rescue territory
              </p>
              <p className="text-sm text-foreground/80">
                Health is above the rescue threshold. No emergency intervention
                is required.
              </p>
            </div>
          </div>

          <Card className="flex flex-col items-center justify-center p-6">
            <HealthGauge
              value={r.health?.overall ?? 0}
              status={r.health?.status ?? scoreToStatus(r.health?.overall ?? 0)}
            />
            <p className="mt-3 flex items-center gap-1.5 text-center text-xs text-muted-foreground">
              <CheckCircle2 size={13} className="text-status-green" /> Current
              overall health
            </p>
          </Card>

          {env?.explanation ? (
            <ExplanationPanel
              explanation={env.explanation}
              title="How rescue posture was assessed"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ListCard({
  icon,
  title,
  items,
  dotClass,
}: {
  icon: ReactNode;
  title: string;
  items: string[] | undefined;
  dotClass: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle icon={icon}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items?.length ? (
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
                {it}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">None recorded.</p>
        )}
      </CardContent>
    </Card>
  );
}
