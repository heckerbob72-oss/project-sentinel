"""
Simulation Engine (Digital Twin) — deterministic what-if analysis.

Takes a baseline project state, applies a scenario mutation, recomputes the
schedule and health with the same deterministic engines, and returns a
before/after comparison. Because it reuses the real engines, the twin behaves
exactly like the live plan would.

Supported scenarios:
  member_unavailable, deadline_shortened, task_delayed, add_requirement,
  scope_reduced, dependency_blocked, testing_extended, capacity_increased
"""
from __future__ import annotations

import copy
from dataclasses import dataclass

from .explain import Calculation, Explanation
from .health import HealthEngine
from .scheduling import SchedulingEngine


@dataclass
class SimulationResult:
    scenario: str
    before: dict
    after: dict
    deltas: dict
    new_risks: list[str]
    explanation: Explanation

    def to_dict(self) -> dict:
        return {
            "scenario": self.scenario,
            "before": self.before,
            "after": self.after,
            "deltas": self.deltas,
            "new_risks": self.new_risks,
            "explanation": self.explanation.to_dict(),
        }


class SimulationEngine:
    def __init__(self):
        self.scheduler = SchedulingEngine()
        self.health = HealthEngine()

    def simulate(self, state: dict, scenario: str, params: dict) -> SimulationResult:
        """
        state: {
          "tasks": [...], "dependencies": [...], "deadline": float,
          "health_metrics": {...}
        }
        scenario: one of the supported scenario keys
        params: scenario-specific parameters
        """
        before = self._snapshot(state)
        mutated = self._apply(copy.deepcopy(state), scenario, params)
        after = self._snapshot(mutated)

        deltas = {
            "project_duration": round(
                after["schedule"]["project_duration"]
                - before["schedule"]["project_duration"],
                2,
            ),
            "health": round(after["health"]["overall"] - before["health"]["overall"], 1),
            "critical_path_changed": (
                before["schedule"]["critical_path"] != after["schedule"]["critical_path"]
            ),
        }

        new_risks = []
        if not after["schedule"].get("deadline_feasible", True) and before["schedule"].get(
            "deadline_feasible", True
        ):
            new_risks.append("Scenario makes the deadline INFEASIBLE.")
        if after["health"]["rescue_recommended"] and not before["health"]["rescue_recommended"]:
            new_risks.append("Scenario drops health into rescue territory (<50).")

        exp = Explanation(
            summary=f"Simulated '{scenario}'.",
            agent="simulation-engine",
            confidence=1.0,
        )
        exp.add_reason(
            "Applied the scenario to a copy of the project state and recomputed "
            "schedule and health with the same deterministic engines."
        )
        exp.add_calc(
            Calculation(
                name="duration_delta",
                formula="after.duration - before.duration",
                inputs={
                    "before": before["schedule"]["project_duration"],
                    "after": after["schedule"]["project_duration"],
                },
                result=deltas["project_duration"],
            )
        )
        exp.add_calc(
            Calculation(
                name="health_delta",
                formula="after.health - before.health",
                inputs={
                    "before": before["health"]["overall"],
                    "after": after["health"]["overall"],
                },
                result=deltas["health"],
            )
        )
        for r in new_risks:
            exp.add_reason(r)

        return SimulationResult(scenario, before, after, deltas, new_risks, exp)

    def _snapshot(self, state: dict) -> dict:
        sched = self.scheduler.schedule(
            state["tasks"], state.get("dependencies", []), state.get("deadline")
        )
        metrics = dict(state.get("health_metrics", {}))
        metrics["schedule_pressure"] = sched.schedule_pressure
        health = self.health.score(metrics)
        return {"schedule": sched.to_dict(), "health": health.to_dict()}

    def _apply(self, state: dict, scenario: str, params: dict) -> dict:
        tasks = state["tasks"]
        if scenario == "deadline_shortened":
            state["deadline"] = state.get("deadline", 30) - params.get("days", 5)
        elif scenario == "task_delayed":
            tid = params["task_id"]
            add = params.get("days", 3)
            for t in tasks:
                if t["id"] == tid:
                    for k in ("optimistic", "most_likely", "pessimistic", "duration"):
                        if k in t:
                            t[k] = float(t[k]) + add
        elif scenario == "testing_extended":
            for t in tasks:
                if "test" in t.get("label", "").lower():
                    for k in ("optimistic", "most_likely", "pessimistic", "duration"):
                        if k in t:
                            t[k] = float(t[k]) + params.get("days", 2)
            state.setdefault("health_metrics", {})
            state["health_metrics"]["testing_window_days"] = params.get("window", 5)
        elif scenario == "scope_reduced":
            drop = set(params.get("task_ids", []))
            state["tasks"] = [t for t in tasks if t["id"] not in drop]
            state["dependencies"] = [
                d
                for d in state.get("dependencies", [])
                if d["source"] not in drop and d["target"] not in drop
            ]
        elif scenario == "add_requirement":
            new = params.get("task", {"id": "T-NEW", "label": "New requirement",
                                      "optimistic": 2, "most_likely": 4, "pessimistic": 8})
            state["tasks"].append(new)
            for dep in params.get("dependencies", []):
                state.setdefault("dependencies", []).append(dep)
        elif scenario == "member_unavailable":
            state.setdefault("health_metrics", {})
            hm = state["health_metrics"]
            hm["max_utilisation"] = hm.get("max_utilisation", 0.8) * 1.4
            hm["overloaded_members"] = hm.get("overloaded_members", 0) + 1
        elif scenario == "capacity_increased":
            state.setdefault("health_metrics", {})
            hm = state["health_metrics"]
            hm["max_utilisation"] = max(0.3, hm.get("max_utilisation", 0.8) * 0.75)
        elif scenario == "dependency_blocked":
            tid = params["task_id"]
            for t in tasks:
                if t["id"] == tid:
                    for k in ("optimistic", "most_likely", "pessimistic", "duration"):
                        if k in t:
                            t[k] = float(t[k]) + params.get("block_days", 5)
        return state
