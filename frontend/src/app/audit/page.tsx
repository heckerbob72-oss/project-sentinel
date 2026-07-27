"use client";

import { useQuery } from "@tanstack/react-query";
import { GitBranch } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TBody, THead, TD, TH, TR, Table } from "@/components/ui/Table";
import { apiGetData } from "@/lib/api";
import type { AuditEntry } from "@/lib/types";
import { formatDateTime, formatPercent } from "@/lib/utils";

export default function AuditPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit"],
    queryFn: () => apiGetData<AuditEntry[]>("/audit"),
    retry: 0,
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <GitBranch size={20} className="text-sentinel-300" /> Audit Trail
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Every agent decision is logged and independently traceable. Open any
          entry to prove it in Explainability Mode.
        </p>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            variant="error"
            title="Audit log unavailable"
            description="The audit API is not reachable right now. This view populates once the backend is online."
          />
        ) : !data?.length ? (
          <EmptyState
            title="No audit entries"
            description="Decisions made across the platform will be recorded here."
          />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Timestamp</TH>
                <TH>Action</TH>
                <TH>Module</TH>
                <TH>Agent</TH>
                <TH className="text-right">Confidence</TH>
                <TH className="text-right">Trace</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((entry) => (
                <TR key={entry.audit_id}>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(entry.timestamp)}
                  </TD>
                  <TD>
                    <div className="font-medium text-foreground">
                      {entry.action}
                    </div>
                    {entry.summary ? (
                      <div className="text-xs text-muted-foreground">
                        {entry.summary}
                      </div>
                    ) : null}
                  </TD>
                  <TD>
                    <Badge variant="muted">{entry.module}</Badge>
                  </TD>
                  <TD className="text-muted-foreground">{entry.agent}</TD>
                  <TD className="text-right tabular-nums">
                    {entry.confidence !== undefined
                      ? formatPercent(entry.confidence)
                      : "—"}
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={`/explainability?audit_id=${encodeURIComponent(entry.audit_id)}`}
                      className="text-xs text-sentinel-300 hover:underline"
                    >
                      Inspect →
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
