"""LangGraph planning workflow orchestrating the Sentinel agent pipeline.

The pipeline mirrors how an experienced co-ordinator plans:
  document analysis -> gap detection -> intake -> project DNA -> methodology ->
  WBS -> resource allocation -> dependency -> timeline -> risk -> health ->
  success -> recovery -> next best action -> reporting.

If LangGraph is installed it builds a real StateGraph; otherwise it runs the
identical node functions sequentially. Either way the behaviour is deterministic
and every node's Explanation is collected into the shared state.
"""
from __future__ import annotations

from typing import Any, TypedDict

from ..agents import (
    DependencyAgent,
    DocumentAnalysisAgent,
    GapDetectionAgent,
    HealthAgent,
    IntakeAgent,
    MethodologyAgent,
    NextBestActionAgent,
    ProjectDNAAgent,
    RecoveryAgent,
    ReportingAgent,
    ResourceAllocationAgent,
    RiskAgent,
    SuccessAgent,
    TimelineAgent,
    WorkBreakdownAgent,
)


class PlanningState(TypedDict, total=False):
    project_type: str
    deliverables: list
    text: str
    document: str
    profile: dict
    members: list
    tasks: list
    dependencies: list
    deadline: float
    metrics: dict
    # accumulated outputs
    facts: dict
    gaps: list
    wbs_items: list
    schedule: dict
    dependency_graph: dict
    allocation: dict
    risks: list
    health: dict
    success: dict
    recovery: dict
    trace: list


def _node_document(state: PlanningState) -> PlanningState:
    if state.get("text"):
        r = DocumentAnalysisAgent().run({"text": state["text"], "document": state.get("document", "doc")})
        state["facts"] = r.data["facts"]
        _trace(state, r)
    return state


def _node_gap(state: PlanningState) -> PlanningState:
    r = GapDetectionAgent().run({"facts": state.get("facts", {})})
    state["gaps"] = r.data["gaps"]
    _trace(state, r)
    return state


def _node_intake(state: PlanningState) -> PlanningState:
    r = IntakeAgent().run({"profile": state.get("profile", {}), "answers": state.get("profile", {})})
    state["profile"] = r.data["profile"]
    _trace(state, r)
    return state


def _node_dna(state: PlanningState) -> PlanningState:
    r = ProjectDNAAgent().run({"profile": state.get("profile", {}), "task_count": len(state.get("tasks", []))})
    _trace(state, r)
    return state


def _node_methodology(state: PlanningState) -> PlanningState:
    r = MethodologyAgent().run({"profile": state.get("profile", {})})
    _trace(state, r)
    return state


def _node_wbs(state: PlanningState) -> PlanningState:
    r = WorkBreakdownAgent().run({
        "project_type": state.get("project_type", "ai_application"),
        "deliverables": state.get("deliverables", []),
    })
    state["wbs_items"] = r.data["wbs_items"]
    # derive engine tasks from WBS if none supplied
    if not state.get("tasks"):
        state["tasks"] = [
            {"id": w["ext_id"], "label": w["title"],
             "optimistic": w["optimistic"], "most_likely": w["most_likely"],
             "pessimistic": w["pessimistic"], "required_skills": w["required_skills"]}
            for w in state["wbs_items"]
        ]
    _trace(state, r)
    return state


def _node_resource(state: PlanningState) -> PlanningState:
    if state.get("members"):
        r = ResourceAllocationAgent().run({"tasks": state.get("tasks", []), "members": state["members"]})
        state["allocation"] = r.data
        _trace(state, r)
    return state


def _node_dependency(state: PlanningState) -> PlanningState:
    r = DependencyAgent().run({"tasks": state.get("tasks", []), "dependencies": state.get("dependencies", [])})
    state["dependency_graph"] = r.data
    _trace(state, r)
    return state


def _node_timeline(state: PlanningState) -> PlanningState:
    r = TimelineAgent().run({
        "tasks": state.get("tasks", []),
        "dependencies": state.get("dependencies", []),
        "deadline": state.get("deadline"),
    })
    state["schedule"] = r.data
    _trace(state, r)
    return state


def _node_risk(state: PlanningState) -> PlanningState:
    metrics = _derive_metrics(state)
    state["metrics"] = metrics
    r = RiskAgent().run({"metrics": metrics})
    state["risks"] = r.data["risks"]
    _trace(state, r)
    return state


def _node_health(state: PlanningState) -> PlanningState:
    metrics = state.get("metrics", {})
    if state.get("risks"):
        metrics = {**metrics, "open_risk_score": max(r["score"] for r in state["risks"])}
    r = HealthAgent().run({"metrics": metrics})
    state["health"] = r.data
    _trace(state, r)
    return state


def _node_success(state: PlanningState) -> PlanningState:
    r = SuccessAgent().run({"metrics": state.get("metrics", {})})
    state["success"] = r.data
    _trace(state, r)
    return state


def _node_recovery(state: PlanningState) -> PlanningState:
    if state.get("risks"):
        r = RecoveryAgent().run({"risks": state["risks"]})
        state["recovery"] = r.data
        _trace(state, r)
    return state


def _node_next(state: PlanningState) -> PlanningState:
    r = NextBestActionAgent().run({"stage": "health_scored"})
    _trace(state, r)
    return state


def _node_report(state: PlanningState) -> PlanningState:
    r = ReportingAgent().run({"report_type": "weekly_status", "facts": {
        "health": state.get("health", {}).get("overall"),
        "open_risks": len(state.get("risks", [])),
        "deadline": state.get("deadline"),
    }})
    _trace(state, r)
    return state


_PIPELINE = [
    _node_document, _node_gap, _node_intake, _node_dna, _node_methodology,
    _node_wbs, _node_resource, _node_dependency, _node_timeline,
    _node_risk, _node_health, _node_success, _node_recovery,
    _node_next, _node_report,
]


def _trace(state: PlanningState, result) -> None:
    state.setdefault("trace", []).append({
        "agent": result.agent,
        "summary": result.explanation.summary,
        "confidence": result.explanation.confidence,
        "next_actions": result.next_actions,
    })


def _derive_metrics(state: PlanningState) -> dict:
    sched = state.get("schedule", {})
    dep = state.get("dependency_graph", {})
    alloc = state.get("allocation", {})
    tasks = state.get("tasks", []) or [1]
    edges = len(state.get("dependencies", []))
    metrics = {
        "schedule_pressure": sched.get("schedule_pressure"),
        "deadline_feasible": 1 if sched.get("deadline_feasible", True) else 0,
        "spof_count": len(dep.get("single_points_of_failure", [])),
        "dependency_density": edges / max(1, len(tasks)),
        "requirement_completeness": _completeness(state),
        "team_size": len(state.get("members", [])),
    }
    if alloc:
        util = alloc.get("utilisation", {})
        metrics["max_utilisation"] = max(util.values()) if util else 0.0
        metrics["overloaded_members"] = len(alloc.get("overloaded_members", []))
        metrics["unassigned_tasks"] = len(alloc.get("unassigned_tasks", []))
        metrics["skill_gap_count"] = len(alloc.get("skill_gaps", []))
    return {k: v for k, v in metrics.items() if v is not None}


def _completeness(state: PlanningState) -> float:
    from ..agents.analysis import INTAKE_FIELDS
    profile = state.get("profile", {})
    filled = [f for f in INTAKE_FIELDS if profile.get(f) not in (None, "", [])]
    return round(len(filled) / len(INTAKE_FIELDS), 3)


def run_planning_workflow(initial: dict) -> dict:
    """Run the full pipeline and return the final state (with trace)."""
    state: PlanningState = dict(initial)  # type: ignore

    try:  # use real LangGraph when available
        from langgraph.graph import END, StateGraph  # type: ignore

        g = StateGraph(PlanningState)
        prev = None
        for node in _PIPELINE:
            g.add_node(node.__name__, node)
            if prev is None:
                g.set_entry_point(node.__name__)
            else:
                g.add_edge(prev, node.__name__)
            prev = node.__name__
        g.add_edge(prev, END)
        compiled = g.compile()
        return dict(compiled.invoke(state))
    except Exception:
        # deterministic sequential fallback (identical node functions)
        for node in _PIPELINE:
            state = node(state)
        return dict(state)
