"use client";

import { useQuery } from "@tanstack/react-query";
import { GitBranch, Workflow } from "lucide-react";
import type { ReactNode } from "react";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiGet } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/types";
import { useProjectStore } from "@/store/useProjectStore";

interface MethodologyResult {
  recommended: string;
  ceremonies: string[];
  artefacts: string[];
  reporting_style?: string;
  pmbok_process_groups: string[];
  pmbok_knowledge_areas: string[];
}

export default function MethodologyPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId) ?? "1";
  const projectName = useProjectStore((s) => s.selectedProjectName);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["methodology", projectId],
    queryFn: () => apiGet<MethodologyResult>(`/projects/${projectId}/methodology`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const env = data as ApiEnvelope<MethodologyResult> | undefined;
  const m = env?.data;

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Workflow size={20} className="text-sentinel-300" /> Methodology
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · the delivery approach tailored to
          this project&apos;s DNA.
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <div className="space-y-4">
          <Card className="p-6">
            <Skeleton className="h-20 w-full" />
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-32 w-full" />
              </Card>
            ))}
          </div>
        </div>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load methodology"
          description="The methodology API is unavailable. This view populates once the backend is online."
        />
      ) : !m ? (
        <EmptyState title="No recommendation" description="No methodology recommendation is available for this project." />
      ) : (
        <div className="space-y-4">
          <Card className="flex flex-col items-start gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="stat-label">Recommended methodology</p>
              <h2 className="mt-1 text-3xl font-semibold capitalize text-foreground">
                {m.recommended}
              </h2>
            </div>
            {m.reporting_style ? (
              <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Reporting style
                </p>
                <p className="mt-0.5 font-medium capitalize text-foreground">
                  {m.reporting_style}
                </p>
              </div>
            ) : null}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChipCard title="Ceremonies" items={m.ceremonies} />
            <ChipCard title="Artefacts" items={m.artefacts} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle icon={<GitBranch size={15} className="text-sentinel-300" />}>
                PMBOK Alignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ChipGroup label="Process Groups" items={m.pmbok_process_groups} variant="brand" />
              <ChipGroup label="Knowledge Areas" items={m.pmbok_knowledge_areas} variant="muted" />
            </CardContent>
          </Card>

          {env?.explanation ? (
            <ExplanationPanel
              explanation={env.explanation}
              title="Why this methodology was recommended"
              defaultOpen
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ChipCard({ title, items }: { title: string; items: string[] | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items?.length ? (
          <div className="flex flex-wrap gap-2">
            {items.map((it) => (
              <span
                key={it}
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-foreground/85"
              >
                {it}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">None recommended.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ChipGroup({
  label,
  items,
  variant,
}: {
  label: string;
  items: string[] | undefined;
  variant: "brand" | "muted";
}): ReactNode {
  const chip =
    variant === "brand"
      ? "border-sentinel-500/30 bg-sentinel-500/15 text-sentinel-200"
      : "border-border bg-surface text-foreground/85";
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {items?.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <span key={it} className={`rounded-md border px-2.5 py-1 text-xs capitalize ${chip}`}>
              {it.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">None mapped.</p>
      )}
    </div>
  );
}
