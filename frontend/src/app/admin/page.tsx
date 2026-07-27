"use client";

import { useQuery } from "@tanstack/react-query";
import { Lock, ShieldHalf } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TBody, THead, TD, TH, TR, Table } from "@/components/ui/Table";
import { apiGetData, ApiRequestError } from "@/lib/api";

interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
}

function roleVariant(role: string | undefined): "brand" | "warning" | "success" | "muted" {
  switch ((role ?? "").toLowerCase()) {
    case "admin":
      return "warning";
    case "teamlead":
    case "team_lead":
    case "manager":
      return "brand";
    case "contributor":
      return "success";
    default:
      return "muted";
  }
}

export default function AdminPage() {
  const { data, isLoading, isError, error, fetchStatus } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiGetData<AdminUser[]>("/admin/users"),
    retry: 0,
  });

  const forbidden = error instanceof ApiRequestError && error.status === 403;
  const users = data ?? [];

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <ShieldHalf size={20} className="text-sentinel-300" /> Admin
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Workspace users and their roles.
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <Card className="p-4">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        </Card>
      ) : forbidden ? (
        <EmptyState
          title="Admin access required"
          description="Your account doesn't have permission to view workspace administration. Ask a workspace admin if you need access."
          icon={<Lock size={26} className="text-status-amber" />}
        />
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load users"
          description="The admin API is unavailable. This view populates once the backend is online."
        />
      ) : !users.length ? (
        <EmptyState title="No users" description="No users were returned for this workspace." />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <span className="text-xs text-muted-foreground">{users.length}</span>
          </CardHeader>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Name</TH>
                <TH>Email</TH>
                <TH className="text-center">Role</TH>
              </TR>
            </THead>
            <TBody>
              {users.map((u) => (
                <TR key={u.id} className="hover:bg-transparent">
                  <TD className="font-medium text-foreground">{u.full_name ?? "—"}</TD>
                  <TD className="text-muted-foreground">{u.email}</TD>
                  <TD className="text-center">
                    <Badge variant={roleVariant(u.role)} className="capitalize">
                      {u.role ?? "member"}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
