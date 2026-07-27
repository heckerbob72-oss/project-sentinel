"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowRight, FlaskConical, Play, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { apiPostData, ApiRequestError } from "@/lib/api";
import type { Simulation } from "@/lib/types";
import { cn, formatNumber, scoreToStatus } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

type ParamKind = "number" | "text" | "list";

interface ParamDef {
  key: string;
  label: string;
  kind: ParamKind;
  default?: string;
  placeholder?: string;
  help?: string;
}

interface ScenarioDef {
  id: string;
  label: string;
  description: string;
  params: ParamDef[];
}

const SCENARIOS: ScenarioDef[] = [
  {
    id: "deadline_shortened",
    label: "Deadline shortened",
    description: "Pull the target deadline in by N days and test feasibility.",
    params: [{ key: "days", label: "Days shorter", kind: "number", default: "5" }],
  },
  {
    id: "task_delayed",
    label: "Task delayed",
    description: "Add slippage to a specific task and observe knock-on effects.",
    params: [
      { key: "task_id", label: "Task ID", kind: "text", placeholder: "T-07" },
      { key: "days", label: "Delay (days)", kind: "number", default: "3" },
    ],
  },
  {
    id: "testing_extended",
    label: "Testing extended",
    description: "Lengthen all test tasks and widen the testing window.",
    params: [
      { key: "days", label: "Extra test days", kind: "number", default: "2" },
      { key: "window", label: "Testing window (days)", kind: "number", default: "5" },
    ],
  },
  {
    id: "scope_reduced",
    label: "Scope reduced",
    description: "Drop a set of tasks from the plan to recover schedule.",
    params: [
      {
        key: "task_ids",
        label: "Task IDs to drop",
        kind: "list",
        placeholder: "T-11, T-12",
        help: "Comma-separated",
      },
    ],
  },
  {
    id: "add_requirement",
    label: "Add requirement",
    description: "Inject a new requirement and re-plan.",
    params: [
      { key: "label", label: "Requirement", kind: "text", placeholder: "New compliance check" },
      { key: "estimate", label: "Estimate (days)", kind: "number", default: "4" },
    ],
  },
  {
    id: "member_unavailable",
    label: "Team member unavailable",
    description: "Remove capacity to model a key person going offline.",
    params: [],
  },
  {
    id: "capacity_increased",
    label: "Capacity increased",
    description: "Add capacity to relieve overloaded team members.",
    params: [],
  },
  {
    id: "dependency_blocked",
    label: "Dependency blocked",
    description: "Block a task's upstream dependency for N days.",
    params: [
      { key: "task_id", label: "Task ID", kind: "text", placeholder: "T-04" },
      { key: "block_days", label: "Block (days)", kind: "number", default: "5" },
    ],
  },
];

export default function SimulationPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId);
  const projectName = useProjectStore((s) => s.selectedProjectName);
  const { toast } = useToast();

  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [values, setValues] = useState<Record<string, string>>({});

  const scenario = useMemo(
    () => SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0],
    [scenarioId],
  );

  const mutation = useMutation({
    mutationFn: (payload: {
      scenario: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params: Record<string, any>;
    }) =>
      apiPostData<Simulation>(`/projects/${projectId}/simulations`, payload),
    onError: (err) => {
      const message =
        err instanceof ApiRequestError ? err.message : "Simulation failed.";
      toast({ title: "Simulation failed", description: message, variant: "error" });
    },
  });

  const buildParams = (): Record<string, unknown> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: Record<string, any> = {};
    for (const p of scenario.params) {
      const raw = values[p.key] ?? p.default ?? "";
      if (p.kind === "number") params[p.key] = Number(raw) || 0;
      else if (p.kind === "list")
        params[p.key] = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      else params[p.key] = raw;
    }
    // Special shaping for add_requirement -> backend expects a task object.
    if (scenario.id === "add_requirement") {
      const est = Number(values.estimate ?? "4") || 4;
      params.task = {
        id: "T-NEW",
        label: values.label || "New requirement",
        optimistic: Math.max(1, Math.round(est * 0.7)),
        most_likely: est,
        pessimistic: Math.round(est * 1.6),
      };
      delete params.label;
      delete params.estimate;
    }
    return params;
  };

  const run = () => {
    if (!projectId) return;
    mutation.mutate({
      scenario: scenario.id,
      params: buildParams(),
    });
  };

  if (!projectId) {
    return (
      <div>
        <h1 className="mb-5 text-xl font-semibold text-foreground">
          Digital Twin Lab
        </h1>
        <EmptyState
          title="No project selected"
          description="Pick a project from the top bar to run what-if simulations."
          action={
            <Link href="/control-tower" className="text-sm text-sentinel-300 hover:underline">
              Go to Control Tower →
            </Link>
          }
        />
      </div>
    );
  }

  const result = mutation.data;

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <FlaskConical size={20} className="text-sentinel-300" /> Digital Twin Lab
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · run a what-if scenario against a
          live twin of the plan.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Scenario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Choose a scenario
              </label>
              <select
                value={scenarioId}
                onChange={(e) => {
                  setScenarioId(e.target.value);
                  setValues({});
                }}
                className="focus-ring h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground"
              >
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {scenario.description}
              </p>
            </div>

            {scenario.params.length ? (
              <div className="space-y-3">
                {scenario.params.map((p) => (
                  <div key={p.key}>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {p.label}
                    </label>
                    <input
                      type={p.kind === "number" ? "number" : "text"}
                      value={values[p.key] ?? p.default ?? ""}
                      placeholder={p.placeholder}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [p.key]: e.target.value }))
                      }
                      className="focus-ring h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground/60"
                    />
                    {p.help ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {p.help}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                This scenario takes no parameters.
              </p>
            )}

            <Button className="w-full" onClick={run} loading={mutation.isPending}>
              <Play size={15} /> Run Simulation
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4 lg:col-span-2">
          {mutation.isError && !result ? (
            <EmptyState
              variant="error"
              title="Simulation could not run"
              description="The simulation API is unavailable, or the parameters were rejected. Adjust and retry."
            />
          ) : !result ? (
            <EmptyState
              title="No simulation run yet"
              description="Configure a scenario on the left and hit Run Simulation to see a before/after comparison."
              icon={<FlaskConical size={26} className="text-muted-foreground" />}
            />
          ) : (
            <SimulationResultView result={result} />
          )}
        </div>
      </div>
    </div>
  );
}

function SimulationResultView({ result }: { result: Simulation }) {
  const beforeDur = result.before.schedule?.project_duration ?? 0;
  const afterDur = result.after.schedule?.project_duration ?? 0;
  const beforeHealth = result.before.health?.overall ?? 0;
  const afterHealth = result.after.health?.overall ?? 0;

  const durDelta = result.deltas?.project_duration ?? afterDur - beforeDur;
  const healthDelta = result.deltas?.health ?? afterHealth - beforeHealth;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <ComparisonCard
          title="Project Duration"
          before={`${formatNumber(beforeDur, 1)}d`}
          after={`${formatNumber(afterDur, 1)}d`}
          delta={durDelta}
          deltaSuffix="d"
          betterWhenLower
        />
        <ComparisonCard
          title="Overall Health"
          before={formatNumber(beforeHealth, 1)}
          after={formatNumber(afterHealth, 1)}
          delta={healthDelta}
          betterWhenLower={false}
          afterBadge={
            <StatusBadge
              status={
                result.after.health?.status ?? scoreToStatus(afterHealth)
              }
              size="sm"
            />
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New / Emerging Risks</CardTitle>
          <Badge variant={result.new_risks.length ? "danger" : "success"}>
            {result.new_risks.length}
          </Badge>
        </CardHeader>
        <CardContent>
          {result.new_risks.length ? (
            <ul className="space-y-1.5">
              {result.new_risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-red" />
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-status-green">
              No new risks introduced by this scenario.
            </p>
          )}
        </CardContent>
      </Card>

      <ExplanationPanel
        explanation={result.explanation}
        title="How this simulation was computed"
        defaultOpen
      />
    </>
  );
}

function ComparisonCard({
  title,
  before,
  after,
  delta,
  deltaSuffix = "",
  betterWhenLower,
  afterBadge,
}: {
  title: string;
  before: string;
  after: string;
  delta: number;
  deltaSuffix?: string;
  betterWhenLower: boolean;
  afterBadge?: ReactNode;
}) {
  const improved = betterWhenLower ? delta < 0 : delta > 0;
  const worsened = betterWhenLower ? delta > 0 : delta < 0;
  const neutral = delta === 0;
  const color = neutral
    ? "text-muted-foreground"
    : improved
      ? "text-status-green"
      : "text-status-red";
  const Icon = delta === 0 ? ArrowRight : improved ? TrendingUp : TrendingDown;

  return (
    <Card className="p-5">
      <p className="stat-label">{title}</p>
      <div className="mt-3 flex items-center gap-3">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Before
          </p>
          <p className="text-xl font-semibold tabular-nums text-muted-foreground">
            {before}
          </p>
        </div>
        <ArrowRight size={16} className="text-muted-foreground" />
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            After
          </p>
          <p className="text-xl font-semibold tabular-nums text-foreground">
            {after}
          </p>
          {afterBadge ? <div className="mt-1">{afterBadge}</div> : null}
        </div>
      </div>
      <div className={cn("mt-3 flex items-center gap-1.5 text-sm font-medium", color)}>
        <Icon size={15} />
        {delta > 0 ? "+" : ""}
        {formatNumber(delta, 1)}
        {deltaSuffix}
        <span className="text-xs font-normal text-muted-foreground">
          {neutral ? "no change" : improved ? "improvement" : "regression"}
        </span>
      </div>
    </Card>
  );
}
