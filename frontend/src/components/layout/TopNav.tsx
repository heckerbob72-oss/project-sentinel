"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, LogOut, Menu, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiGetData } from "@/lib/api";
import type { Health, Project } from "@/lib/types";
import { cn, scoreToStatus } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useUIStore } from "@/store/useUIStore";

export function TopNav() {
  const router = useRouter();
  const { user, token, logout } = useAuthStore();
  const { selectedProjectId, selectedProjectName, setSelectedProject } =
    useProjectStore();
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiGetData<Project[]>("/projects"),
    enabled: Boolean(token),
    retry: 0,
  });

  const { data: health } = useQuery({
    queryKey: ["health", selectedProjectId],
    queryFn: () => apiGetData<Health>(`/projects/${selectedProjectId}/health`),
    enabled: Boolean(token && selectedProjectId),
    retry: 0,
  });

  // Default-select the first project once loaded.
  useEffect(() => {
    if (projects && projects.length > 0) {
      const selectedExists = projects.some(
        (project) => String(project.id) === String(selectedProjectId),
      );
      if (selectedExists) return;
      const first = projects[0];
      setSelectedProject(String(first.id), first.name);
    }
  }, [projects, selectedProjectId, setSelectedProject]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    router.push("/login");
  };

  const healthStatus = health
    ? health.status ?? scoreToStatus(health.overall)
    : undefined;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/80 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle — the sidebar has no other entry point below md */}
        <button
          type="button"
          onClick={toggleMobileNav}
          aria-label="Open menu"
          className="focus-ring -ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-overlay hover:text-foreground md:hidden"
        >
          <Menu size={18} />
        </button>

        {/* Project selector */}
        <div className="relative">
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => {
              const p = projects?.find((x) => String(x.id) === e.target.value);
              setSelectedProject(e.target.value || null, p?.name ?? null);
            }}
            className="focus-ring h-9 appearance-none rounded-lg border border-border bg-surface-raised pl-3 pr-8 text-sm text-foreground"
            aria-label="Select project"
          >
            {!projects || projects.length === 0 ? (
              <option value="">No projects</option>
            ) : (
              <>
                <option value="">Select project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </>
            )}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
        </div>

        {/* Health pill for the selected project */}
        {selectedProjectId && health ? (
          <div className="hidden items-center gap-2 sm:flex">
            <StatusBadge status={healthStatus} label={`Health ${Math.round(health.overall)}`} />
            {health.rescue_recommended ? (
              <StatusBadge status="critical" label="Rescue advised" showDot={false} />
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-muted-foreground lg:inline">
          {selectedProjectName ?? "No project selected"}
        </span>

        {!token ? (
          <Link
            href="/login"
            className="focus-ring flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 text-sm text-foreground hover:bg-surface-overlay"
          >
            <UserIcon size={15} /> Sign in
          </Link>
        ) : (
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="focus-ring flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-raised px-2.5 text-sm hover:bg-surface-overlay"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sentinel-600 text-[11px] font-semibold text-white">
              {(user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[140px] truncate text-muted-foreground md:inline">
              {user?.name ?? user?.email ?? "Signed out"}
            </span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-11 w-52 animate-fade-in rounded-lg border border-border bg-surface-overlay p-1 shadow-panel">
              <div className="border-b border-border px-3 py-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {user?.name ?? "Guest"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email ?? "Not signed in"}
                </p>
              </div>
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <UserIcon size={15} /> Settings
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-status-red hover:bg-status-red/10"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          ) : null}
        </div>
        )}
      </div>
    </header>
  );
}
