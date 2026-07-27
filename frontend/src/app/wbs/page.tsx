"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ListTree } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState, type ReactNode } from "react";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TBody, THead, TD, TH, TR, Table } from "@/components/ui/Table";
import { apiGetData } from "@/lib/api";
import type { WbsItem, WbsResult } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

/** Normalise either a flat parent_id list or a nested children[] tree to rows. */
function flatten(items: WbsItem[]): Array<WbsItem & { depth: number }> {
  const out: Array<WbsItem & { depth: number }> = [];
  const hasChildren = items.some((i) => i.children && i.children.length);

  if (hasChildren) {
    const walk = (nodes: WbsItem[], depth: number) => {
      for (const n of nodes) {
        out.push({ ...n, depth });
        if (n.children?.length) walk(n.children, depth + 1);
      }
    };
    walk(items, 0);
  } else {
    for (const n of items) out.push({ ...n, depth: n.level ?? 0 });
  }
  return out;
}

export default function WbsPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId);
  const projectName = useProjectStore((s) => s.selectedProjectName);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["wbs", projectId],
    queryFn: () => apiGetData<WbsResult>(`/projects/${projectId}/wbs`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const grouped = useMemo(() => {
    const rows = flatten(data?.items ?? []);
    const map = new Map<string, Array<WbsItem & { depth: number }>>();
    for (const r of rows) {
      const phase = r.phase ?? "Unphased";
      const bucket = map.get(phase) ?? [];
      bucket.push(r);
      map.set(phase, bucket);
    }
    return map;
  }, [data]);

  if (!projectId) return <NoProject />;

  return (
    <div>
      <Header
        title="Work Breakdown Structure"
        subtitle={projectName ?? undefined}
        right={
          data?.total_effort !== undefined ? (
            <Badge variant="brand">
              Total effort: {formatNumber(data.total_effort)}{" "}
              {data.items[0]?.effort_unit ?? "pts"}
            </Badge>
          ) : null
        }
      />

      {isLoading && fetchStatus !== "idle" ? (
        <Card className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Card>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load the WBS"
          description="The work-breakdown API is unavailable. This view populates once the backend is online."
        />
      ) : !data?.items?.length ? (
        <EmptyState
          title="No work breakdown yet"
          description="Submit a brief in Intake to generate a work breakdown structure."
        />
      ) : (
        <div className="space-y-5">
          {[...grouped.entries()].map(([phase, rows]) => {
            const phaseEffort = rows.reduce((s, r) => s + (r.effort ?? 0), 0);
            return (
              <Card key={phase} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <ListTree size={15} className="text-sentinel-300" />
                    {phase}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {rows.length} items · {formatNumber(phaseEffort)}{" "}
                    {rows[0]?.effort_unit ?? "pts"}
                  </span>
                </div>
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH className="w-[45%]">Item</TH>
                      <TH>Owner</TH>
                      <TH className="text-right">Effort</TH>
                      <TH className="text-right">Why</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rows.map((item) => {
                      const key = item.id;
                      const isOpen = expanded === key;
                      return (
                        <Fragment key={key}>
                          <TR>
                            <TD>
                              <div
                                className="flex items-center gap-1.5"
                                style={{ paddingLeft: item.depth * 18 }}
                              >
                                {item.code ? (
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    {item.code}
                                  </span>
                                ) : null}
                                <span className="font-medium text-foreground">
                                  {item.label}
                                </span>
                                {item.status ? (
                                  <Badge variant="muted">{item.status}</Badge>
                                ) : null}
                              </div>
                            </TD>
                            <TD className="text-muted-foreground">
                              {item.owner ?? "—"}
                            </TD>
                            <TD className="text-right tabular-nums">
                              {item.effort !== undefined
                                ? `${formatNumber(item.effort)} ${item.effort_unit ?? ""}`.trim()
                                : "—"}
                            </TD>
                            <TD className="text-right">
                              {item.explanation ? (
                                <button
                                  onClick={() =>
                                    setExpanded(isOpen ? null : key)
                                  }
                                  className="inline-flex items-center gap-1 text-xs text-sentinel-300 hover:underline"
                                >
                                  <ChevronRight
                                    size={13}
                                    className={cn(
                                      "transition-transform",
                                      isOpen && "rotate-90",
                                    )}
                                  />
                                  Explain
                                </button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TD>
                          </TR>
                          {isOpen && item.explanation ? (
                            <TR className="hover:bg-transparent">
                              <TD colSpan={4} className="bg-surface/40">
                                <ExplanationPanel
                                  explanation={item.explanation}
                                  defaultOpen
                                  title={`Estimate for ${item.label}`}
                                  compact
                                />
                              </TD>
                            </TR>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </TBody>
                </Table>
              </Card>
            );
          })}

          {data.explanation ? (
            <ExplanationPanel
              explanation={data.explanation}
              title="How this breakdown was derived"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function Header({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </div>
  );
}

function NoProject() {
  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-foreground">
        Work Breakdown Structure
      </h1>
      <EmptyState
        title="No project selected"
        description="Pick a project from the top bar to view its work breakdown."
        action={
          <Link href="/control-tower" className="text-sm text-sentinel-300 hover:underline">
            Go to Control Tower →
          </Link>
        }
      />
    </div>
  );
}
