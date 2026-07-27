"use client";

import { useMutation } from "@tanstack/react-query";
import { CheckSquare, Gavel, NotebookPen, OctagonAlert, Sparkles } from "lucide-react";

import { ExplanationPanel } from "@/components/ExplanationPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TBody, THead, TD, TH, TR, Table } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiPost, ApiRequestError } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/types";
import { useState } from "react";

interface ActionItem {
  description: string;
  owner?: string;
}

interface Minutes {
  attendees: string[];
  summary: string;
  decisions: string[];
  action_items: ActionItem[];
  blockers: string[];
}

export default function MeetingMinutesPage() {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [attendees, setAttendees] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: { notes: string; attendees: string[] }) =>
      apiPost<Minutes>("/meeting-minutes/generate", payload),
    onError: (err) => {
      const message =
        err instanceof ApiRequestError ? err.message : "Could not generate minutes.";
      toast({ title: "Generation failed", description: message, variant: "error" });
    },
  });

  const generate = () => {
    if (!notes.trim()) {
      toast({ title: "Add some notes first", variant: "warning" });
      return;
    }
    mutation.mutate({
      notes: notes.trim(),
      attendees: attendees
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    });
  };

  const env = mutation.data as ApiEnvelope<Minutes> | undefined;
  const minutes = env?.data;

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <NotebookPen size={20} className="text-sentinel-300" /> Meeting Minutes
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Turn raw notes into a structured summary, decisions, and tracked actions.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Raw Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Attendees (comma-separated)
              </label>
              <input
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                placeholder="Dana Ruiz, Sam Okoro, Priya N"
                className="focus-ring h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Meeting notes
              </label>
              <textarea
                rows={12}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste the raw meeting notes here…"
                className="focus-ring min-h-[220px] w-full resize-y rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60"
              />
            </div>
            <Button className="w-full" onClick={generate} loading={mutation.isPending}>
              <Sparkles size={15} /> Generate Minutes
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {mutation.isError && !minutes ? (
            <EmptyState
              variant="error"
              title="Could not generate minutes"
              description="The minutes API is unavailable, or the notes were rejected. Adjust and retry."
            />
          ) : !minutes ? (
            <EmptyState
              title="No minutes yet"
              description="Paste notes on the left and hit Generate Minutes to produce a structured record."
              icon={<NotebookPen size={26} className="text-muted-foreground" />}
            />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-foreground/90">{minutes.summary}</p>
                  {minutes.attendees?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {minutes.attendees.map((a) => (
                        <span
                          key={a}
                          className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-foreground/85"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle icon={<Gavel size={15} className="text-sentinel-300" />}>
                    Decisions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {minutes.decisions?.length ? (
                    <ul className="space-y-1.5">
                      {minutes.decisions.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sentinel-400" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No decisions recorded.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle icon={<CheckSquare size={15} className="text-status-green" />}>
                    Action Items
                  </CardTitle>
                </CardHeader>
                {minutes.action_items?.length ? (
                  <Table>
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH>Action</TH>
                        <TH>Owner</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {minutes.action_items.map((a, i) => (
                        <TR key={i} className="hover:bg-transparent">
                          <TD className="text-foreground/90">{a.description}</TD>
                          <TD className="text-muted-foreground">{a.owner ?? "Unassigned"}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                ) : (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">No action items captured.</p>
                  </CardContent>
                )}
              </Card>

              {minutes.blockers?.length ? (
                <Card className="border-status-amber/30 bg-status-amber/5">
                  <CardHeader>
                    <CardTitle icon={<OctagonAlert size={15} className="text-status-amber" />}>
                      Blockers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {minutes.blockers.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-amber" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}

              {env?.explanation ? (
                <ExplanationPanel
                  explanation={env.explanation}
                  title="How these minutes were generated"
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
