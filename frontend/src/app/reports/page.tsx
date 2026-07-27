"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileBarChart, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { apiGetData, apiPostData, ApiRequestError } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

interface Report {
  id: string;
  report_type: string;
  title: string;
  body: string;
  generated_by?: string;
  created_at?: string;
}

interface ReportsResult {
  available_types: string[];
  reports: Report[];
}

export default function ReportsPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId) ?? "1";
  const projectName = useProjectStore((s) => s.selectedProjectName);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [reportType, setReportType] = useState<string>("");
  const [generated, setGenerated] = useState<Report | null>(null);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["reports", projectId],
    queryFn: () => apiGetData<ReportsResult>(`/projects/${projectId}/reports`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const types = data?.available_types ?? [];
  const reports = data?.reports ?? [];
  const selectedType = reportType || types[0] || "";

  const mutation = useMutation({
    mutationFn: (type: string) =>
      apiPostData<Report>(`/projects/${projectId}/reports`, { report_type: type }),
    onSuccess: (report) => {
      setGenerated(report);
      toast({ title: "Report generated", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["reports", projectId] });
    },
    onError: (err) => {
      const message =
        err instanceof ApiRequestError ? err.message : "Report generation failed.";
      toast({ title: "Couldn't generate report", description: message, variant: "error" });
    },
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <FileBarChart size={20} className="text-sentinel-300" /> Reports
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · generate audit-ready status and
          risk reports.
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <Card className="p-5">
          <Skeleton className="h-24 w-full" />
        </Card>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load reports"
          description="The reports API is unavailable. This view populates once the backend is online."
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate a Report</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Report type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setReportType(e.target.value)}
                  disabled={!types.length}
                  className="focus-ring h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm capitalize text-foreground disabled:opacity-50"
                >
                  {types.length ? (
                    types.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </option>
                    ))
                  ) : (
                    <option value="">No types available</option>
                  )}
                </select>
              </div>
              <Button
                onClick={() => selectedType && mutation.mutate(selectedType)}
                loading={mutation.isPending}
                disabled={!selectedType}
              >
                <Sparkles size={15} /> Generate
              </Button>
            </CardContent>
          </Card>

          {generated ? (
            <Card className="border-sentinel-500/40">
              <CardHeader>
                <CardTitle>{generated.title}</CardTitle>
                <Badge variant="brand">{generated.report_type?.replace(/_/g, " ")}</Badge>
              </CardHeader>
              <CardContent>
                <ReportBody body={generated.body} />
                <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
                  {generated.generated_by ? `By ${generated.generated_by} · ` : ""}
                  {formatDateTime(generated.created_at)}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Previously Generated</CardTitle>
              <span className="text-xs text-muted-foreground">{reports.length}</span>
            </CardHeader>
            <CardContent>
              {reports.length ? (
                <ul className="space-y-2">
                  {reports.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-md border border-border bg-surface px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{r.title}</span>
                        <Badge variant="muted">{r.report_type?.replace(/_/g, " ")}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {r.generated_by ? `${r.generated_by} · ` : ""}
                        {formatDateTime(r.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No reports generated yet — pick a type above and hit Generate.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ReportBody({ body }: { body: string }) {
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
      {body}
    </div>
  );
}
