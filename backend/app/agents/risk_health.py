"""Risk, Health, Success, Recovery, Rescue, and Next-Best-Action agents."""
from __future__ import annotations

from ..engines import (
    HealthEngine,
    RiskContext,
    RiskEngine,
    SuccessProbabilityCalculator,
)
from ..engines.explain import Explanation
from .base import AgentResult, BaseAgent


class RiskAgent(BaseAgent):
    name = "risk-agent"
    purpose = "Evaluate rule-based, evidence-backed project risks."

    def run(self, payload: dict) -> AgentResult:
        ctx = RiskContext(metrics=payload.get("metrics", {}))
        risks = RiskEngine().evaluate(ctx)
        exp = Explanation(
            summary=f"Evaluated risk rulebook — {len(risks)} risk(s) triggered.",
            agent=self.name,
            confidence=1.0,
        )
        for r in risks:
            exp.trigger(r.rule_id)
            exp.add_evidence(f"rule:{r.rule_id}", r.title, value=r.score)
        na = []
        crit = [r for r in risks if r.severity == "critical"]
        if crit:
            na.append(self._na("Open recovery planning",
                               f"{len(crit)} critical risk(s) detected",
                               "critical", "recovery"))
        return AgentResult(self.name, {"risks": [r.to_dict() for r in risks]}, exp, na)


class HealthAgent(BaseAgent):
    name = "project-health-agent"
    purpose = "Compute explainable 0..100 project health."

    def run(self, payload: dict) -> AgentResult:
        res = HealthEngine().score(payload.get("metrics", {}))
        na = []
        if res.rescue_recommended:
            na.append(self._na("Activate rescue mode",
                               f"Health {res.overall:.0f} below 50",
                               "critical", "rescue"))
        return AgentResult(self.name, res.to_dict(), res.explanation, na)


class SuccessAgent(BaseAgent):
    name = "success-probability-agent"
    purpose = "Estimate delivery success with a transparent weighted model."

    def run(self, payload: dict) -> AgentResult:
        res = SuccessProbabilityCalculator().calculate(payload.get("metrics", {}))
        return AgentResult(self.name, res.to_dict(), res.explanation, [])


class RecoveryAgent(BaseAgent):
    name = "recovery-agent"
    purpose = "Propose corrective recovery actions for identified risks."

    _PLAYBOOK = {
        "RISK_RESOURCE_OVERLOAD": ("Redistribute workload; add backup owner", 25),
        "RISK_SCHEDULE_COMPRESSION": ("Reduce scope; parallelise critical tasks", 35),
        "RISK_TESTING_WINDOW_MINIMUM": ("Front-load test planning; test in parallel", 30),
        "RISK_SINGLE_POINT_OF_FAILURE": ("Assign backup owner; decouple dependencies", 20),
        "RISK_SKILL_MISMATCH": ("Pair-program or bring in a specialist", 20),
        "RISK_UNCLEAR_REQUIREMENTS": ("Run gap analysis; freeze scope", 25),
        "RISK_DEADLINE_INFEASIBLE": ("Cut non-critical scope; escalate deadline", 40),
        "RISK_DEMO_READINESS": ("Prepare fallback demo; protect demo tasks", 25),
    }

    def run(self, payload: dict) -> AgentResult:
        risks = payload.get("risks", [])
        exp = Explanation(
            summary="Generated recovery recommendations for open risks.",
            agent=self.name,
            confidence=0.9,
        )
        actions = []
        total_reduction = 0
        for r in sorted(risks, key=lambda x: x.get("score", 0), reverse=True):
            rid = r.get("rule_id")
            play = self._PLAYBOOK.get(rid)
            if not play:
                continue
            action, reduction = play
            total_reduction += reduction
            actions.append({
                "risk": rid,
                "action": action,
                "expected_risk_reduction_pct": reduction,
                "owner": "TBD",
                "urgency": r.get("severity", "medium"),
            })
            exp.add_reason(f"For {rid}: {action} (~{reduction}% risk reduction).")
            exp.trigger(rid)
        na = [self._na("Review recovery plan", "Human approval required before applying",
                       "high", "recovery")]
        return AgentResult(
            self.name,
            {"actions": actions, "estimated_total_reduction_pct": total_reduction,
             "approval_status": "suggested"},
            exp, na,
        )


class RescueAgent(BaseAgent):
    name = "project-rescue-agent"
    purpose = "Activate urgent recovery workflow when the project is in danger."

    def run(self, payload: dict) -> AgentResult:
        health = payload.get("health", {})
        risks = payload.get("risks", [])
        overall = health.get("overall", 100)
        exp = Explanation(summary="", agent=self.name, confidence=0.9)

        criteria = []
        if overall < 50:
            criteria.append(f"Health {overall:.0f} < 50")
        crit_risks = [r for r in risks if r.get("severity") == "critical"]
        if crit_risks:
            criteria.append(f"{len(crit_risks)} critical risk(s)")
        active = bool(criteria)

        exp.summary = ("Rescue mode ACTIVE." if active else "Rescue mode not required.")
        for c in criteria:
            exp.add_reason(f"Trigger: {c}")
            exp.trigger("HEALTH_RESCUE_THRESHOLD")

        top_issues = [r.get("title") for r in crit_risks[:3]] or \
            [r.get("title") for r in risks[:3]]
        data = {
            "active": active,
            "criteria_met": criteria,
            "top_critical_issues": top_issues,
            "immediate_actions": [
                "Protect demo-critical and critical-path tasks",
                "Defer non-critical features",
                "Escalate to stakeholders with a decision request",
            ] if active else [],
        }
        na = [self._na("Escalate to stakeholders", "Rescue actions need sign-off",
                       "critical", "executive")] if active else []
        return AgentResult(self.name, data, exp, na)


class NextBestActionAgent(BaseAgent):
    name = "next-best-action-agent"
    purpose = "Recommend the next logical workflow step."

    _FLOW = {
        "project_created": ("Upload project documents", "documents"),
        "documents_ingested": ("Run gap analysis", "intake"),
        "gaps_resolved": ("Generate the WBS", "wbs"),
        "wbs_ready": ("Allocate resources", "resources"),
        "allocated": ("Build the timeline", "timeline"),
        "scheduled": ("Evaluate risks", "risks"),
        "risks_evaluated": ("Review project health", "health"),
        "health_scored": ("Generate stakeholder report", "reports"),
    }

    def run(self, payload: dict) -> AgentResult:
        stage = payload.get("stage", "project_created")
        action, module = self._FLOW.get(stage, ("Review dashboard", "dashboard"))
        exp = Explanation(
            summary=f"Recommended next step after '{stage}'.",
            agent=self.name, confidence=0.85,
        )
        exp.add_reason(
            f"Sentinel's planning pipeline places '{action}' immediately after "
            f"'{stage}'."
        )
        na = [self._na(action, f"Next logical step after {stage}", "high", module)]
        return AgentResult(self.name, {"suggested_action": action, "module": module}, exp, na)
