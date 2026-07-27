"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Lightbulb } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiGetData } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Lesson {
  category: string;
  title: string;
  detail: string;
  recommendation?: string;
  tags?: string[];
}

function categoryLabel(category: string): string {
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Accent colour for a lesson category (went_well is green, went_wrong is red). */
function categoryAccent(category: string): { bar: string; text: string } {
  const c = category.toLowerCase();
  if (c.includes("well") || c.includes("success") || c.includes("positive")) {
    return { bar: "border-l-status-green", text: "text-status-green" };
  }
  if (c.includes("wrong") || c.includes("fail") || c.includes("negative") || c.includes("risk")) {
    return { bar: "border-l-status-red", text: "text-status-red" };
  }
  return { bar: "border-l-sentinel-500", text: "text-sentinel-300" };
}

export default function LessonsLearnedPage() {
  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: ["lessons-learned"],
    queryFn: () => apiGetData<Lesson[]>("/lessons-learned"),
    retry: 0,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const l of data ?? []) {
      const key = l.category ?? "general";
      const bucket = map.get(key) ?? [];
      bucket.push(l);
      map.set(key, bucket);
    }
    return Array.from(map.entries());
  }, [data]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <BookOpen size={20} className="text-sentinel-300" /> Lessons Learned
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          What worked, what didn&apos;t, and the recommendations that came out of it.
        </p>
      </div>

      {isLoading && fetchStatus !== "idle" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-28 w-full" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          variant="error"
          title="Couldn't load lessons"
          description="The lessons-learned API is unavailable. This view populates once the backend is online."
        />
      ) : !grouped.length ? (
        <EmptyState title="No lessons captured" description="No lessons learned have been recorded yet." />
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, lessons]) => {
            const accent = categoryAccent(category);
            return (
              <section key={category}>
                <h2
                  className={cn(
                    "mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider",
                    accent.text,
                  )}
                >
                  {categoryLabel(category)}
                  <span className="rounded-full bg-surface-overlay px-2 py-0.5 text-[11px] text-muted-foreground">
                    {lessons.length}
                  </span>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {lessons.map((l, i) => (
                    <Card
                      key={`${l.title}-${i}`}
                      className={cn("border-l-2 p-5", accent.bar)}
                    >
                      <h3 className="font-medium text-foreground">{l.title}</h3>
                      <p className="mt-1 text-sm text-foreground/80">{l.detail}</p>
                      {l.recommendation ? (
                        <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2">
                          <Lightbulb size={14} className="mt-0.5 shrink-0 text-status-amber" />
                          <p className="text-xs text-foreground/85">{l.recommendation}</p>
                        </div>
                      ) : null}
                      {l.tags?.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {l.tags.map((t) => (
                            <Badge key={t} variant="muted">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
