/**
 * Shared TypeScript contracts for the Project Sentinel API.
 *
 * These mirror the backend's structured-explanation envelope. Every important
 * response is wrapped in {@link ApiEnvelope}; errors follow {@link ApiError}.
 * The philosophy: no output is a black box — everything carries an Explanation.
 */

export type StatusColor = "green" | "amber" | "red" | "critical";

export type Priority = "low" | "medium" | "high" | "critical";

/** A single traceable fact backing a decision. */
export interface Evidence {
  source: string;
  detail: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}

/** A named, reproducible calculation with inputs and result. */
export interface Calculation {
  name: string;
  formula: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
}

/** The canonical explanation attached to any Sentinel output. */
export interface Explanation {
  summary: string;
  reasoning: string[];
  evidence: Evidence[];
  rules_triggered: string[];
  calculations: Calculation[];
  assumptions: string[];
  alternatives: string[];
  /** 0..1 confidence. */
  confidence: number;
  agent: string;
  timestamp: string;
}

/** A recommended follow-up surfaced by an agent. */
export interface NextAction {
  action: string;
  reason: string;
  priority: string;
  module: string;
}

/** Success envelope wrapping every important response. */
export interface ApiEnvelope<T> {
  status: "success";
  data: T;
  explanation: Explanation;
  audit_id: string;
  next_actions: NextAction[];
}

/** Error envelope. */
export interface ApiError {
  status: "error";
  error_code: string;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any>;
  suggested_action: string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginResponse {
  access_token: string;
  token_type?: string;
}

export interface User {
  id?: string;
  email: string;
  name?: string;
  role?: string;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  name: string;
  description?: string;
  objective?: string;
  project_type?: string;
  priority?: string;
  status?: string;
  methodology?: string;
  phase?: string;
  start_date?: string;
  end_date?: string;
  deadline?: string;
  budget?: number;
  progress?: number;
  /** Real backend field (0..1) — how complete the intake profile is. */
  intake_completeness?: number;
  health_score?: number;
  health_status?: StatusColor;
  owner?: string;
  team_size?: number;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthDimension {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  rationale: string;
}

export interface Health {
  overall: number;
  status: StatusColor;
  rescue_recommended: boolean;
  dimensions: HealthDimension[];
  top_drivers: string[];
  explanation: Explanation;
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

export interface Risk {
  rule_id: string;
  title: string;
  category: string;
  severity: string;
  /** 1..5 or 0..1 depending on engine; treated numerically. */
  probability: number;
  impact: number;
  score: number;
  evidence: Evidence[] | string[];
  recommended_action: string;
  explanation: Explanation;
}

// ---------------------------------------------------------------------------
// WBS
// ---------------------------------------------------------------------------

export interface WbsItem {
  id: string;
  code?: string;
  label: string;
  phase?: string;
  parent_id?: string | null;
  level?: number;
  effort?: number;
  effort_unit?: string;
  owner?: string;
  status?: string;
  explanation?: Explanation;
  children?: WbsItem[];
}

export interface WbsResult {
  items: WbsItem[];
  phases?: string[];
  total_effort?: number;
  explanation?: Explanation;
}

// ---------------------------------------------------------------------------
// Timeline / Scheduling
// ---------------------------------------------------------------------------

export interface Task {
  id: string;
  label: string;
  duration: number;
  earliest_start: number;
  earliest_finish: number;
  total_float: number;
  is_critical: boolean;
}

export interface GanttBar {
  task_id: string;
  label: string;
  start: number;
  end: number;
  critical: boolean;
}

export interface TimelineResult {
  tasks: Task[];
  project_duration: number;
  critical_path: string[];
  deadline_feasible: boolean;
  gantt: GanttBar[];
  explanation?: Explanation;
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface DependencyNode {
  id: string;
  label: string;
  successors?: string[];
  predecessors?: string[];
}

export interface DependencyEdge {
  source: string;
  target: string;
  dependency_type?: string;
  reason?: string;
}

export interface DependencyGraphResult {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  cycle?: { has_cycle: boolean; cycle_path: string[] };
  topological_order?: string[];
  bottlenecks?: Array<Record<string, unknown>>;
  single_points_of_failure?: string[];
  explanation?: Explanation;
}

// ---------------------------------------------------------------------------
// Resources / Assignments
// ---------------------------------------------------------------------------

export interface Assignment {
  task_id: string;
  task_label?: string;
  assignee: string;
  role?: string;
  allocation?: number;
  start?: number;
  end?: number;
  overallocated?: boolean;
  explanation?: Explanation;
}

// ---------------------------------------------------------------------------
// Simulation (Digital Twin Lab)
// ---------------------------------------------------------------------------

export interface SimulationSnapshot {
  schedule: TimelineResult;
  health: Health;
}

export interface SimulationDeltas {
  project_duration: number;
  health: number;
  [key: string]: number;
}

export interface Simulation {
  scenario: string;
  before: SimulationSnapshot;
  after: SimulationSnapshot;
  deltas: SimulationDeltas;
  new_risks: string[];
  explanation: Explanation;
}

export interface SimulationRequest {
  project_id: string;
  scenario: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Audit / Explainability
// ---------------------------------------------------------------------------

export interface AuditEntry {
  audit_id: string;
  timestamp: string;
  agent: string;
  module: string;
  action: string;
  summary?: string;
  project_id?: string;
  confidence?: number;
  explanation?: Explanation;
}

export interface ExplainabilityRecord {
  audit_id: string;
  module: string;
  agent: string;
  timestamp: string;
  explanation: Explanation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}
