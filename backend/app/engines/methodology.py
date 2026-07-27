"""
Methodology Engine — recommends a delivery methodology and maps PMBOK.

Deterministic decision rules over project characteristics recommend one of:
Waterfall, Agile/Scrum, Kanban, or Hybrid — with ceremonies, artefacts, and a
reporting style. Also maps the project to PMBOK process groups and knowledge
areas so a PMO can trace governance.
"""
from __future__ import annotations

from dataclasses import dataclass

from .explain import Explanation

PMBOK_PROCESS_GROUPS = [
    "initiating", "planning", "executing", "monitoring_and_controlling", "closing",
]
PMBOK_KNOWLEDGE_AREAS = [
    "integration", "scope", "schedule", "cost", "quality", "resource",
    "communication", "risk", "procurement", "stakeholder",
]

_PROFILES = {
    "scrum": {
        "ceremonies": ["Sprint Planning", "Daily Stand-up", "Sprint Review", "Retrospective"],
        "artefacts": ["Product Backlog", "Sprint Backlog", "Increment", "Burndown Chart"],
        "reporting": "Sprint review + burndown, fortnightly",
    },
    "kanban": {
        "ceremonies": ["Daily Stand-up", "Replenishment", "Delivery Planning"],
        "artefacts": ["Kanban Board", "WIP Limits", "Cumulative Flow Diagram"],
        "reporting": "Flow metrics (cycle time, throughput), continuous",
    },
    "waterfall": {
        "ceremonies": ["Phase Gate Reviews", "Change Control Board"],
        "artefacts": ["Requirements Spec", "Gantt Chart", "Test Plan", "Sign-off"],
        "reporting": "Phase-gate status, milestone-based",
    },
    "hybrid": {
        "ceremonies": ["Phase Gates", "Sprint Planning", "Daily Stand-up", "Review"],
        "artefacts": ["Milestone Plan", "Sprint Backlog", "Risk Register", "Burndown"],
        "reporting": "Milestone gate + sprint cadence",
    },
}


@dataclass
class MethodologyResult:
    recommended: str
    ceremonies: list[str]
    artefacts: list[str]
    reporting_style: str
    pmbok_process_groups: list[str]
    pmbok_knowledge_areas: list[str]
    explanation: Explanation

    def to_dict(self) -> dict:
        return {
            "recommended": self.recommended,
            "ceremonies": self.ceremonies,
            "artefacts": self.artefacts,
            "reporting_style": self.reporting_style,
            "pmbok_process_groups": self.pmbok_process_groups,
            "pmbok_knowledge_areas": self.pmbok_knowledge_areas,
            "explanation": self.explanation.to_dict(),
        }


class MethodologyEngine:
    def recommend(self, profile: dict) -> MethodologyResult:
        """
        profile keys:
          requirements_stability: 0..1 (1 = fully stable/known upfront)
          duration_days: int
          team_size: int
          change_frequency: "low"|"medium"|"high"
          regulatory: bool (heavy compliance/sign-off)
          continuous_delivery: bool (steady stream of small items)
          preference: optional explicit methodology override
        """
        exp = Explanation(summary="", agent="methodology-engine", confidence=0.9)

        pref = profile.get("preference")
        if pref in _PROFILES:
            rec = pref
            exp.add_reason(f"User explicitly preferred {pref}.")
        else:
            rec = self._decide(profile, exp)

        prof = _PROFILES[rec]
        exp.summary = f"Recommended methodology: {rec.title()}."
        exp.add_evidence("methodology-engine", "Decision inputs", value=profile)

        return MethodologyResult(
            recommended=rec,
            ceremonies=prof["ceremonies"],
            artefacts=prof["artefacts"],
            reporting_style=prof["reporting"],
            pmbok_process_groups=PMBOK_PROCESS_GROUPS,
            pmbok_knowledge_areas=PMBOK_KNOWLEDGE_AREAS,
            explanation=exp,
        )

    def _decide(self, p, exp) -> str:
        stability = p.get("requirements_stability", 0.5)
        change = p.get("change_frequency", "medium")
        regulatory = p.get("regulatory", False)
        continuous = p.get("continuous_delivery", False)

        if continuous and change == "high":
            exp.add_reason(
                "Continuous stream of small items with high change → Kanban "
                "(flow-based, WIP-limited)."
            )
            return "kanban"
        if regulatory and stability >= 0.75:
            exp.add_reason(
                "Stable, heavily-regulated requirements → Waterfall with phase gates."
            )
            return "waterfall"
        if stability < 0.5 or change == "high":
            exp.add_reason(
                "Evolving requirements / frequent change → Agile Scrum (iterative, "
                "sprint-based)."
            )
            return "scrum"
        exp.add_reason(
            "Mixed stability with some fixed milestones → Hybrid (phase gates + "
            "sprint execution)."
        )
        return "hybrid"
