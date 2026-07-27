"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Megaphone } from "lucide-react";
import { useState } from "react";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { NextBestActions } from "@/components/NextBestActions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { apiGetData, apiPost, ApiRequestError } from "@/lib/api";
import type { ApiEnvelope, NextAction, StatusColor } from "@/lib/types";
import { scoreToStatus } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

interface SummaryHealth {
  overall: number;
  status?: StatusColor | string;
  rescue_recommended?: boolean;
}

interface ProjectSummary {
  health: SummaryHealth;
  success_probability: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface DraftResult {
  tone: string;
  draft: string;
}

const TONES = ["concise", "formal", "executive", "client-friendly", "urgent"] as const;
type Tone = (typeof TONES)[number];

export default function ExecutivePage() {
  const projectId = useProjectStore((s) => s.selectedProjectId) ?? "1";
  const projectName = useProjectStore((s) => s.selectedProjectName);
  const { toast } = useToast();

  const [tone, setTone] = useState<Tone>("executive");
  const [copied, setCopied] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["project-summary", projectId],
    queryFn: () => apiGetData<ProjectSummary>(`/projects/${projectId}/summary`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const summary = summaryQuery.data;

  const mutation = useMutation({
    mutationFn: (payload: { tone: string; facts: Record<string, unknown> }) =>
      apiPost<DraftResult>("/executive/draft", payload),
    onSuccess: () => setCopied(false),
    onError: (err) => {
      const message = err instanceof ApiRequestError ? err.message : "Draft failed.";
      toast({ title: "Couldn't draft update", description: message, variant: "error" });
    },
  });

  const draftEnv = mutation.data as ApiEnvelope<DraftResult> | undefined;
  const draft = draftEnv?.data;
  const nextActions: NextAction[] = draftEnv?.next_actions ?? [];

  const onDraft = () => {
    if (!summary) return;
    const status =
      summary.health?.status ?? scoreToStatus(summary.health?.overall ?? 0);
    mutation.mutate({
      tone,
      facts: {
        health: summary.health?.overall,
        success_probability: summary.success_probability,
        status,
        rescue_recommended: summary.health?.rescue_recommended,
        project: projectName ?? undefined,
      },
    });
  };

  const copyDraft = async () => {
    if (!draft?.draft) return;
    try {
      await navigator.clipboard.writeText(draft.draft);
      setCopied(true);
      toast({ title: "Copied to clipboard", variant: "success" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy", variant: "error" });
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Megaphone size={20} className="text-sentinel-300" /> Executive Update
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · draft a leadership-ready update
          grounded in the project&apos;s facts.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Compose</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="focus-ring h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm capitalize text-foreground"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              {summaryQuery.isLoading && summaryQuery.fetchStatus !== "idle" ? (
                <Skeleton className="h-10 w-full" />
              ) : summary ? (
                <>
                  Grounded in: health{" "}
                  <span className="font-medium text-foreground/90">
                    {Math.round(summary.health?.overall ?? 0)}
                  </span>
                  , success{" "}
                  <span className="font-medium text-foreground/90">
                    {Math.round(
                      (summary.success_probability ?? 0) <= 1
                        ? (summary.success_probability ?? 0) * 100
                        : summary.success_probability ?? 0,
                    )}
                    %
                  </span>
                  .
                </>
              ) : (
                "Facts will be fetched from the project summary."
              )}
            </div>

            <Button
              className="w-full"
              onClick={onDraft}
              loading={mutation.isPending}
              disabled={!summary}
            >
              Draft update
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {summaryQuery.isError ? (
            <EmptyState
              variant="error"
              title="Couldn't load project facts"
              description="The summary API is unavailable, so there are no facts to ground the update. Try again once the backend is online."
            />
          ) : mutation.isError && !draft ? (
            <EmptyState
              variant="error"
              title="Draft could not be generated"
              description="The executive-draft API is unavailable, or the request was rejected. Adjust the tone and retry."
            />
          ) : !draft ? (
            <EmptyState
              title="No draft yet"
              description="Pick a tone and hit Draft update to generate a grounded executive message."
              icon={<Megaphone size={26} className="text-muted-foreground" />}
            />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Draft</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="brand" className="capitalize">
                      {draft.tone}
                    </Badge>
                    <Button size="sm" variant="secondary" onClick={copyDraft}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {draft.draft}
                  </div>
                </CardContent>
              </Card>

              {nextActions.length ? (
                <div className="rounded-lg border border-status-amber/30 bg-status-amber/5 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-status-amber">
                    Review before sending
                  </p>
                  <NextBestActions actions={nextActions} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Review this draft before sending — Sentinel drafts are grounded
                  but not auto-sent.
                </p>
              )}

              {draftEnv?.explanation ? (
                <ExplanationPanel
                  explanation={draftEnv.explanation}
                  title="How this draft was grounded"
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
