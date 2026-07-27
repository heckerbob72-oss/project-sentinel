"use client";

import { useQuery } from "@tanstack/react-query";
import { LogOut, Moon, Server, Settings as SettingsIcon, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { API_BASE_URL, apiGetData } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

interface Me {
  id?: string;
  email: string;
  full_name?: string;
  role?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const logout = useAuthStore((s) => s.logout);
  const storedUser = useAuthStore((s) => s.user);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["auth-me"],
    queryFn: () => apiGetData<Me>("/auth/me"),
    retry: 0,
  });

  const me = data ?? (storedUser as Me | null);

  const signOut = () => {
    logout();
    toast({ title: "Signed out", variant: "success" });
    router.push("/login");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <SettingsIcon size={20} className="text-sentinel-300" /> Settings
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Your profile, workspace connection, and appearance.
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle icon={<UserCircle size={15} className="text-sentinel-300" />}>
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && fetchStatus !== "idle" ? (
              <Skeleton className="h-20 w-full" />
            ) : !me && isError ? (
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t load your profile — the backend may be offline.
              </p>
            ) : me ? (
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sentinel-600/15 text-lg font-semibold text-sentinel-200">
                  {(me.full_name ?? me.email ?? "?").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {me.full_name ?? "—"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{me.email}</p>
                  {me.role ? (
                    <Badge variant="brand" className="mt-1 capitalize">
                      {me.role}
                    </Badge>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No profile available.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle icon={<Server size={15} className="text-sentinel-300" />}>
              Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
              <span className="text-sm text-muted-foreground">API base URL</span>
              <code className="font-mono text-xs text-foreground/90">{API_BASE_URL}</code>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle icon={<Moon size={15} className="text-sentinel-300" />}>
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Project Sentinel uses a dark control-tower theme, tuned for long
              monitoring sessions. Light mode is not currently configurable.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Sign out</p>
              <p className="text-xs text-muted-foreground">
                End your session on this device.
              </p>
            </div>
            <Button variant="danger" onClick={signOut}>
              <LogOut size={15} /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
