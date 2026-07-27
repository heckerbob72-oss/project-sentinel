"use client";

import { useQuery } from "@tanstack/react-query";
import { Dna } from "lucide-react";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiGet } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/types";
import { useProjectStore } from "@/store/useProjectStore";

interface ProjectDna {
  project_type?: string;
  methodology?: string;
  complexity?: string;
  risk_tolerance?: string;
  team_size?: number;
  dependency_density?: string | number;
  technology_stack?: string[];
  innovation_level?: string;
}

interface DnaResult {
  dna: ProjectDna;
}

export default function ProjectDnaPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId) ?? "1";
  const projectName = useProjectStore((s) => s.selectedProjectName);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["dna", projectId],
    queryFn: () => apiGet<DnaResult>(`/projects/${projectId}/dna`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const env = data as ApiEnvelope<DnaResult> | undefined;
  const dna = env?.data?.dna;

  const facts: { label: string; value: string | number | undefined }[] = dna
    ? [
        { label: "Project type", value: dna.project_type },
        { label: "Methodology", value: dna.methodology },
        { label: "Complexity", value: dna.complexity },
        { label: "Risk tolerance", value: dna.risk_tolerance },
        { label: "Team size", value: dna.team_size },
        { label: "Dependency density", value: dna.dependency_density },
        { label: "Innovation level", value: dna.innovation_level },
      ]
    : [];

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Dna size={20} className="text-sentinel-300" /> Project DNA
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · the fingerprint that drives
          methodology and risk models.
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <Card className="p-6">
          <Skeleton className="h-56 w-full" />
        </Card>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load project DNA"
          description="The DNA API is unavailable. This view populates once the backend is online."
        />
      ) : !dna ? (
        <EmptyState title="No DNA profile" description="No DNA profile is available for this project." />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DNA Fingerprint</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
                {facts.map((f) => (
                  <div key={f.label} className="bg-surface px-4 py-3">
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {f.label}
                    </dt>
                    <dd className="mt-1 text-sm font-medium capitalize text-foreground">
                      {f.value === undefined || f.value === null || f.value === ""
                        ? "—"
                        : String(f.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technology Stack</CardTitle>
            </CardHeader>
            <CardContent>
              {dna.technology_stack?.length ? (
                <div className="flex flex-wrap gap-2">
                  {dna.technology_stack.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-sentinel-500/30 bg-sentinel-500/15 px-2.5 py-1 text-xs text-sentinel-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No technology stack recorded.</p>
              )}
            </CardContent>
          </Card>

          {env?.explanation ? (
            <ExplanationPanel
              explanation={env.explanation}
              title="How this DNA profile was derived"
              defaultOpen
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
