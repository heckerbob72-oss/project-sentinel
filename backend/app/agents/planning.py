"""Planning agents: Work Breakdown, Dependency, Timeline, Resource Allocation.

These agents are thin, explainable orchestrators over the deterministic engines.
They add project grounding (templates, deliverable mapping) but never invent
computed values.
"""
from __future__ import annotations

from ..engines import (
    DependencyEngine,
    ResourceEngine,
    SchedulingEngine,
)
from ..engines.explain import Explanation
from .base import AgentResult, BaseAgent
from .templates import get_template


class WorkBreakdownAgent(BaseAgent):
    name = "work-breakdown-agent"
    purpose = "Generate an explainable WBS from a project-type template."

    def run(self, payload: dict) -> AgentResult:
        project_type = payload.get("project_type", "ai_application")
        deliverables = payload.get("deliverables", [])
        template = get_template(project_type)

        items = []
        exp = Explanation(
            summary=f"Generated WBS from '{template['name']}' template.",
            agent=self.name,
            confidence=0.95,
        )
        exp.add_reason(
            "WBS is derived from a curated template for the project type, not "
            "invented, so every task is justified and repeatable."
        )
        counter = 1
        for p_idx, phase in enumerate(template["phases"], start=1):
            for t_idx, task in enumerate(phase["tasks"], start=1):
                o, m, pess = task["effort"]
                wbs_code = f"{p_idx}.{t_idx}"
                deliverable = deliverables[(counter - 1) % len(deliverables)] if deliverables else phase["phase"]
                items.append({
                    "wbs_code": wbs_code,
                    "ext_id": f"T-{counter:02d}",
                    "phase": phase["phase"],
                    "title": task["title"],
                    "deliverable": deliverable,
                    "optimistic": o, "most_likely": m, "pessimistic": pess,
                    "required_skills": task["skills"],
                    "template_source": template["key"],
                    "explanation": f"Standard task in phase '{phase['phase']}' for a {template['name']}.",
                })
                counter += 1
        exp.add_evidence(self.name, "Template used", value=template["key"])
        exp.add_evidence(self.name, "Task count", value=len(items))

        na = [self._na("Build dependency graph", "WBS is ready to sequence",
                       "high", "dependencies")]
        return AgentResult(self.name, {"wbs_items": items}, exp, na)


class DependencyAgent(BaseAgent):
    name = "dependency-management-agent"
    purpose = "Build and validate the task dependency DAG."

    def run(self, payload: dict) -> AgentResult:
        res = DependencyEngine().build(payload["tasks"], payload.get("dependencies", []))
        na = []
        if res.cycle.has_cycle:
            na.append(self._na("Resolve dependency cycle",
                               "Scheduling is blocked until the cycle is broken",
                               "critical", "dependencies"))
        else:
            na.append(self._na("Build timeline", "DAG is valid; schedule it",
                               "high", "timeline"))
        return AgentResult(self.name, res.to_dict(), res.explanation, na)


class TimelineAgent(BaseAgent):
    name = "timeline-agent"
    purpose = "Compute the CPM/PERT schedule and critical path."

    def run(self, payload: dict) -> AgentResult:
        res = SchedulingEngine().schedule(
            payload["tasks"], payload.get("dependencies", []), payload.get("deadline")
        )
        na = []
        if res.deadline_feasible is False:
            na.append(self._na("Trigger rescue mode",
                               "Deadline is infeasible per CPM",
                               "critical", "rescue"))
        na.append(self._na("Evaluate risks", "Schedule ready for risk analysis",
                            "high", "risks"))
        return AgentResult(self.name, res.to_dict(), res.explanation, na)


class ResourceAllocationAgent(BaseAgent):
    name = "resource-allocation-agent"
    purpose = "Assign tasks to members by skill and capacity."

    def run(self, payload: dict) -> AgentResult:
        res = ResourceEngine().allocate(payload["tasks"], payload["members"])
        na = []
        if res.overloaded_members:
            na.append(self._na("Rebalance workload",
                               "One or more members are overloaded",
                               "high", "resources"))
        if res.skill_gaps:
            na.append(self._na("Address skill gaps",
                               f"Missing skills: {', '.join(res.skill_gaps)}",
                               "high", "resources"))
        return AgentResult(self.name, res.to_dict(), res.explanation, na)
