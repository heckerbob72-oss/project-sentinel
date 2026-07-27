"use client";

import { useQuery } from "@tanstack/react-query";
import { Mail, UsersRound } from "lucide-react";

import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiGetData } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

interface Member {
  id: string;
  name: string;
  role?: string;
  email?: string;
  capacity_hours?: number;
  skills?: Record<string, number>;
}

interface MembersResult {
  members: Member[];
}

/** Colour a skill chip by mastery level (1–5). */
function skillLevelClass(level: number): string {
  if (level >= 5) return "border-status-green/40 bg-status-green/10 text-status-green";
  if (level >= 4) return "border-sentinel-500/40 bg-sentinel-500/15 text-sentinel-200";
  if (level >= 3) return "border-status-amber/40 bg-status-amber/10 text-status-amber";
  return "border-border bg-surface text-muted-foreground";
}

export default function TeamPlannerPage() {
  const projectId = useProjectStore((s) => s.selectedProjectId) ?? "1";
  const projectName = useProjectStore((s) => s.selectedProjectName);

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => apiGetData<MembersResult>(`/projects/${projectId}/members`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const members = data?.members ?? [];

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <UsersRound size={20} className="text-sentinel-300" /> Team Planner
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {projectName ?? "Selected project"} · the people, their capacity, and
          their skills.
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-32 w-full" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load the team"
          description="The team API is unavailable. This view populates once the backend is online."
        />
      ) : !members.length ? (
        <EmptyState title="No team members" description="No people are assigned to this project yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const skills = Object.entries(member.skills ?? {});
            return (
              <Card key={member.id} className="p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sentinel-600/15 text-sm font-semibold text-sentinel-200">
                    {initials(member.name)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-foreground">{member.name}</h3>
                    {member.role ? (
                      <p className="truncate text-xs text-muted-foreground">{member.role}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {member.capacity_hours !== undefined ? (
                    <span>
                      Capacity:{" "}
                      <span className="font-medium text-foreground/90">
                        {member.capacity_hours}h
                      </span>
                    </span>
                  ) : null}
                  {member.email ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail size={12} /> {member.email}
                    </span>
                  ) : null}
                </div>

                {skills.length ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map(([skill, level]) => (
                        <span
                          key={skill}
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize",
                            skillLevelClass(Number(level)),
                          )}
                          title={`Level ${level} / 5`}
                        >
                          {skill} · {level}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
