"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  Github,
  Loader2,
  Radar,
  Rocket,
  Sparkles,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import {
  apiGetData,
  apiPostData,
  apiPostFormData,
  ApiRequestError,
} from "@/lib/api";
import type { Project } from "@/lib/types";
import { cn, scoreToStatus } from "@/lib/utils";
import { useProjectStore } from "@/store/useProjectStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Gap {
  field: string;
  importance: string;
  question: string;
  expected_answer_type?: string;
  affected_modules?: string[];
}

interface GapResult {
  gaps: Gap[];
  completeness: number;
}

interface ImportResult {
  profile: Record<string, unknown>;
  completeness: number;
  [key: string]: unknown;
}

interface GeneratePlanResult {
  task_count: number;
  dependency_count: number;
  members_added: number;
  has_cycle: boolean;
  template_used: string | null;
}

interface QaEntry {
  field: string;
  question: string;
  answer: string;
}

const IMPORTANCE_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const NEW_PROJECT_DEFAULTS = {
  name: "",
  description: "",
  project_type: "ai_application",
  methodology: "agile",
};

type ImportTab = "github" | "text" | "file";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntakePage() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedProjectId, selectedProjectName, setSelectedProject } =
    useProjectStore();

  if (!selectedProjectId) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader />
        <NewProjectCard
          onCreated={(project) => {
            setSelectedProject(project.id, project.name);
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            toast({ title: `"${project.name}" created`, variant: "success" });
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader subtitle={selectedProjectName ?? undefined} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ImportCard projectId={selectedProjectId} />
          <SuggestedQuestionsCard projectId={selectedProjectId} />
        </div>
        <div className="space-y-4">
          <CompletenessCard projectId={selectedProjectId} />
          <GeneratePlanCard
            projectId={selectedProjectId}
            onDone={() => router.push("/timeline")}
          />
        </div>
      </div>
    </div>
  );
}

function PageHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
        <ClipboardList size={20} className="text-sentinel-300" /> Project Intake
      </h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {subtitle
          ? `${subtitle} · import a GitHub repo, paste a brief, or upload a file, then answer a few questions.`
          : "Start a new project, then import a GitHub repo, paste a brief, or upload a file to build it out."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: create a project (only shown when none is selected)
// ---------------------------------------------------------------------------

function NewProjectCard({ onCreated }: { onCreated: (p: Project) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(NEW_PROJECT_DEFAULTS);

  const mutation = useMutation({
    mutationFn: () => apiPostData<Project>("/projects", form),
    onSuccess: (project) => onCreated(project),
    onError: (err) => {
      const message =
        err instanceof ApiRequestError ? err.message : "Couldn't create the project.";
      toast({ title: "Couldn't create project", description: message, variant: "error" });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast({ title: "Give the project a name (2+ chars)", variant: "warning" });
      return;
    }
    mutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Rocket size={15} className="text-sentinel-300" />}>
          Start your project
        </CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Project name" className="sm:col-span-2">
            <input
              className={inputCls()}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Atlas Payments Migration"
            />
          </Field>
          <Field label="Short description" className="sm:col-span-2">
            <textarea
              rows={2}
              className={areaCls()}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="One or two sentences on scope and outcome."
            />
          </Field>
          <Field label="Project type">
            <select
              className={inputCls()}
              value={form.project_type}
              onChange={(e) => setForm((f) => ({ ...f, project_type: e.target.value }))}
            >
              <option value="ai_application">AI application</option>
              <option value="web_application">Web application</option>
              <option value="hackathon">Hackathon</option>
            </select>
          </Field>
          <Field label="Methodology">
            <select
              className={inputCls()}
              value={form.methodology}
              onChange={(e) => setForm((f) => ({ ...f, methodology: e.target.value }))}
            >
              <option value="agile">Agile</option>
              <option value="waterfall">Waterfall</option>
              <option value="hybrid">Hybrid</option>
              <option value="kanban">Kanban</option>
            </select>
          </Field>
        </CardContent>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="submit" loading={mutation.isPending}>
            Create project
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 2: import a source (GitHub / paste text / upload file)
// ---------------------------------------------------------------------------

function ImportCard({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ImportTab>("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["gaps", projectId] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const onImportSuccess = (result: ImportResult) => {
    const pct = Math.round(
      result.completeness <= 1 ? result.completeness * 100 : result.completeness,
    );
    toast({
      title: "Imported successfully",
      description: `Intake is now ${pct}% complete.`,
      variant: "success",
    });
    invalidate();
  };

  const onImportError = (err: unknown, fallback: string) => {
    const message = err instanceof ApiRequestError ? err.message : fallback;
    const suggestion =
      err instanceof ApiRequestError ? err.suggestedAction : undefined;
    toast({
      title: "Import failed",
      description: suggestion ? `${message} ${suggestion}` : message,
      variant: "error",
    });
  };

  const githubMutation = useMutation({
    mutationFn: () =>
      apiPostData<ImportResult>(`/projects/${projectId}/import/github`, {
        repo_url: repoUrl,
      }),
    onSuccess: onImportSuccess,
    onError: (err) => onImportError(err, "Couldn't import the repo."),
  });

  const textMutation = useMutation({
    mutationFn: () =>
      apiPostData<ImportResult>(`/projects/${projectId}/import/text`, { text }),
    onSuccess: (result) => {
      onImportSuccess(result);
      setText("");
    },
    onError: (err) => onImportError(err, "Couldn't import the text."),
  });

  const fileMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const doc = await apiPostFormData<{ facts: Record<string, unknown> }>(
        `/projects/${projectId}/documents`,
        form,
      );
      // Merge the extracted facts into the intake profile, same as the other
      // import channels (the upload endpoint only stores/extracts them).
      return apiPostData<ImportResult>(`/intake/${projectId}`, {
        answers: doc.facts,
      });
    },
    onSuccess: onImportSuccess,
    onError: (err) => onImportError(err, "Couldn't process the file."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Upload size={15} className="text-sentinel-300" />}>
          Import project data
        </CardTitle>
      </CardHeader>
      <div className="flex gap-1 border-b border-border px-5">
        <TabButton active={tab === "github"} onClick={() => setTab("github")} icon={<Github size={14} />}>
          GitHub repo
        </TabButton>
        <TabButton active={tab === "text"} onClick={() => setTab("text")} icon={<FileText size={14} />}>
          Paste text
        </TabButton>
        <TabButton active={tab === "file"} onClick={() => setTab("file")} icon={<Upload size={14} />}>
          Upload file
        </TabButton>
      </div>
      <CardContent>
        {tab === "github" ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className={cn(inputCls(), "sm:flex-1")}
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
            />
            <Button
              onClick={() => githubMutation.mutate()}
              loading={githubMutation.isPending}
              disabled={repoUrl.trim().length < 3}
            >
              Import repo
            </Button>
          </div>
        ) : tab === "text" ? (
          <div className="space-y-3">
            <textarea
              rows={5}
              className={areaCls()}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a project brief, meeting notes, or a bullet list of deliverables…"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => textMutation.mutate()}
                loading={textMutation.isPending}
                disabled={text.trim().length < 1}
              >
                Import text
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.csv,.json,.md"
              className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface-overlay file:px-3 file:py-1.5 file:text-sm file:text-foreground"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) fileMutation.mutate(file);
              }}
            />
            {fileMutation.isPending ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin" /> Processing file…
              </span>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-sentinel-400 text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step 3: conversational suggested questions
// ---------------------------------------------------------------------------

function SuggestedQuestionsCard({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeField, setActiveField] = useState<Gap | null>(null);
  const [answer, setAnswer] = useState("");
  const [log, setLog] = useState<QaEntry[]>([]);

  const { data: gapResult, isLoading } = useQuery({
    queryKey: ["gaps", projectId],
    queryFn: () => apiGetData<GapResult>(`/projects/${projectId}/gaps`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const gaps = [...(gapResult?.gaps ?? [])].sort(
    (a, b) =>
      (IMPORTANCE_ORDER[a.importance?.toLowerCase()] ?? 9) -
      (IMPORTANCE_ORDER[b.importance?.toLowerCase()] ?? 9),
  );

  const answerMutation = useMutation({
    mutationFn: (gap: Gap) => {
      const value =
        gap.expected_answer_type === "list"
          ? answer.split(",").map((v) => v.trim()).filter(Boolean)
          : gap.expected_answer_type === "number"
            ? Number(answer)
            : answer;
      return apiPostData<{ profile: Record<string, unknown>; completeness: number }>(
        `/intake/${projectId}`,
        { answers: { [gap.field]: value } },
      );
    },
    onSuccess: (_result, gap) => {
      setLog((l) => [...l, { field: gap.field, question: gap.question, answer }]);
      setActiveField(null);
      setAnswer("");
      queryClient.invalidateQueries({ queryKey: ["gaps", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => {
      const message = err instanceof ApiRequestError ? err.message : "Couldn't save that answer.";
      toast({ title: "Couldn't save answer", description: message, variant: "error" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Sparkles size={15} className="text-sentinel-300" />}>
          Suggested questions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {log.length ? (
          <ul className="space-y-2 border-b border-border pb-4">
            {log.map((entry, i) => (
              <li key={`${entry.field}-${i}`} className="text-sm">
                <p className="text-muted-foreground">{entry.question}</p>
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <CheckCircle2 size={13} className="text-status-green" /> {entry.answer}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading suggestions…</p>
        ) : gaps.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-status-green">
            <Sparkles size={15} /> Brief is complete — ready to generate a plan.
          </div>
        ) : activeField ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{activeField.question}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type={activeField.expected_answer_type === "date" ? "date" : "text"}
                className={cn(inputCls(), "sm:flex-1")}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={
                  activeField.expected_answer_type === "list"
                    ? "Comma-separated list…"
                    : "Your answer…"
                }
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => answerMutation.mutate(activeField)}
                  loading={answerMutation.isPending}
                  disabled={!answer.trim()}
                >
                  Save
                </Button>
                <Button variant="ghost" onClick={() => { setActiveField(null); setAnswer(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Click a question to answer it — the list updates as your intake fills in.
            </p>
            <div className="flex flex-wrap gap-2">
              {gaps.slice(0, 8).map((g) => (
                <button
                  key={g.field}
                  type="button"
                  onClick={() => { setActiveField(g); setAnswer(""); }}
                  className="focus-ring flex items-center gap-1.5 rounded-full border border-border bg-surface-overlay px-3 py-1.5 text-xs text-foreground hover:bg-surface"
                >
                  <Badge
                    variant={
                      g.importance === "critical" || g.importance === "high"
                        ? "danger"
                        : g.importance === "medium"
                          ? "warning"
                          : "muted"
                    }
                    className="px-1.5 py-0"
                  >
                    {g.importance}
                  </Badge>
                  {g.question}
                </button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Side panel: live completeness
// ---------------------------------------------------------------------------

function CompletenessCard({ projectId }: { projectId: string }) {
  const { data: gapResult } = useQuery({
    queryKey: ["gaps", projectId],
    queryFn: () => apiGetData<GapResult>(`/projects/${projectId}/gaps`),
    enabled: Boolean(projectId),
    retry: 0,
  });

  const completeness = gapResult
    ? Math.round(gapResult.completeness <= 1 ? gapResult.completeness * 100 : gapResult.completeness)
    : 0;
  const status = scoreToStatus(completeness);

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Radar size={15} className="text-sentinel-300" />}>
          Intake completeness
        </CardTitle>
        <StatusBadge status={status} label={`${completeness}%`} />
      </CardHeader>
      <CardContent>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              status === "green"
                ? "bg-status-green"
                : status === "amber"
                  ? "bg-status-amber"
                  : status === "red"
                    ? "bg-status-red"
                    : "bg-status-critical",
            )}
            style={{ width: `${completeness}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {gapResult?.gaps.length ?? 0} open {gapResult?.gaps.length === 1 ? "gap" : "gaps"} remaining.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 4: generate the plan
// ---------------------------------------------------------------------------

function GeneratePlanCard({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => apiPostData<GeneratePlanResult>(`/projects/${projectId}/generate-plan`, {}),
    onSuccess: (result) => {
      toast({
        title: "Plan generated",
        description: `${result.task_count} tasks, ${result.dependency_count} dependencies, ${result.members_added} member(s) added.`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["health", projectId] });
      onDone();
    },
    onError: (err) => {
      const message = err instanceof ApiRequestError ? err.message : "Couldn't generate the plan.";
      toast({ title: "Couldn't generate plan", description: message, variant: "error" });
    },
  });

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <p className="text-xs text-muted-foreground">
          Turns the accumulated intake into a real work breakdown, dependency
          graph, and team allocation — every task is explained and traceable.
        </p>
        <Button className="w-full" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          <Rocket size={15} /> Generate plan
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared field helpers
// ---------------------------------------------------------------------------

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function inputCls(): string {
  return "focus-ring h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground/60";
}

function areaCls(): string {
  return "focus-ring h-auto min-h-[64px] w-full resize-y rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60";
}
