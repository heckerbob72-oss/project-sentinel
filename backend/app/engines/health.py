"""
Health Engine — explainable 0..100 project health score.

Health is a weighted sum of independent, individually-explained dimensions.
Each dimension is scored 0..100 from deterministic project metrics. The final
score maps to a Green/Amber/Red/Critical band and can trip rescue mode.

This is transparent scoring: every dimension shows its inputs, its sub-score,
and its contribution to the total.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .explain import Calculation, Explanation

# dimension -> weight (weights sum to 1.0)
DEFAULT_WEIGHTS: dict[str, float] = {
    "schedule": 0.18,
    "workload": 0.12,
    "resource": 0.10,
    "risk": 0.15,
    "dependency": 0.08,
    "requirement_clarity": 0.10,
    "delivery_readiness": 0.09,
    "testing_readiness": 0.08,
    "stakeholder_alignment": 0.04,
    "documentation": 0.03,
    "demo_readiness": 0.03,
}

RESCUE_THRESHOLD = 50.0


@dataclass
class DimensionScore:
    name: str
    score: float           # 0..100
    weight: float
    contribution: float     # score * weight
    rationale: str

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "score": round(self.score, 1),
            "weight": self.weight,
            "contribution": round(self.contribution, 2),
            "rationale": self.rationale,
        }


@dataclass
class HealthResult:
    overall: float
    status: str
    rescue_recommended: bool
    dimensions: list[DimensionScore]
    top_drivers: list[str]
    explanation: Explanation

    def to_dict(self) -> dict:
        return {
            "overall": round(self.overall, 1),
            "status": self.status,
            "rescue_recommended": self.rescue_recommended,
            "dimensions": [d.to_dict() for d in self.dimensions],
            "top_drivers": self.top_drivers,
            "explanation": self.explanation.to_dict(),
        }


class HealthEngine:
    def __init__(self, weights: dict[str, float] | None = None):
        self.weights = weights or DEFAULT_WEIGHTS

    @staticmethod
    def status_for(score: float) -> str:
        if score >= 80:
            return "green"
        if score >= 60:
            return "amber"
        if score >= 40:
            return "red"
        return "critical"

    def score(self, metrics: dict) -> HealthResult:
        """
        metrics keys (all optional; missing -> neutral 60):
          schedule_pressure, max_utilisation, overloaded_members, team_size,
          open_risk_score (0..100 worst risk), spof_count, dependency_density,
          requirement_completeness (0..1), delivery_readiness (0..1),
          testing_window_days, stakeholder_alignment (0..1),
          documentation_ratio (0..1), demo_readiness (0..1)
        """
        dims: list[DimensionScore] = []

        dims.append(self._schedule(metrics))
        dims.append(self._workload(metrics))
        dims.append(self._resource(metrics))
        dims.append(self._risk(metrics))
        dims.append(self._dependency(metrics))
        dims.append(self._clarity(metrics))
        dims.append(self._delivery(metrics))
        dims.append(self._testing(metrics))
        dims.append(self._stakeholder(metrics))
        dims.append(self._documentation(metrics))
        dims.append(self._demo(metrics))

        overall = sum(d.contribution for d in dims)
        status = self.status_for(overall)
        rescue = overall < RESCUE_THRESHOLD

        top = sorted(dims, key=lambda d: d.contribution)[:3]
        top_drivers = [f"{d.name} ({d.score:.0f}/100)" for d in top]

        exp = Explanation(
            summary=f"Project health = {overall:.0f}/100 ({status.upper()}).",
            agent="health-engine",
            confidence=1.0,
        )
        exp.add_reason(
            "Health is a weighted sum of 11 independently-scored dimensions."
        )
        for d in dims:
            exp.add_calc(
                Calculation(
                    name=f"dim:{d.name}",
                    formula="score * weight",
                    inputs={"score": round(d.score, 1), "weight": d.weight},
                    result=round(d.contribution, 2),
                )
            )
        exp.add_calc(
            Calculation(
                name="overall_health",
                formula="sum(dimension.score * dimension.weight)",
                inputs={"dimensions": len(dims)},
                result=round(overall, 1),
            )
        )
        exp.add_reason(f"Lowest-contributing dimensions: {', '.join(top_drivers)}.")
        if rescue:
            exp.trigger("HEALTH_RESCUE_THRESHOLD")
            exp.add_reason(
                f"Health {overall:.0f} is below the rescue threshold "
                f"({RESCUE_THRESHOLD:.0f}); rescue mode is recommended."
            )

        return HealthResult(
            overall=overall,
            status=status,
            rescue_recommended=rescue,
            dimensions=dims,
            top_drivers=top_drivers,
            explanation=exp,
        )

    # ----- dimension scorers (each returns 0..100) -----

    def _dim(self, name, score, rationale) -> DimensionScore:
        score = max(0.0, min(100.0, score))
        w = self.weights.get(name, 0.0)
        return DimensionScore(name, score, w, score * w, rationale)

    def _schedule(self, m) -> DimensionScore:
        p = m.get("schedule_pressure")
        if p is None:
            return self._dim("schedule", 60, "No deadline set; neutral score.")
        if p <= 0.8:
            s, r = 100, f"Comfortable buffer (pressure {p:.2f})."
        elif p <= 1.0:
            s, r = 100 - (p - 0.8) / 0.2 * 40, f"Tight but feasible (pressure {p:.2f})."
        else:
            s, r = max(0, 60 - (p - 1.0) * 120), f"Infeasible (pressure {p:.2f} > 1.0)."
        return self._dim("schedule", s, r)

    def _workload(self, m) -> DimensionScore:
        u = m.get("max_utilisation")
        if u is None:
            return self._dim("workload", 60, "No allocation data; neutral score.")
        if u <= 0.85:
            s, r = 100, f"Healthy load (max util {u:.0%})."
        elif u <= 1.0:
            s, r = 100 - (u - 0.85) / 0.15 * 30, f"Near capacity (max util {u:.0%})."
        else:
            s, r = max(0, 70 - (u - 1.0) * 150), f"Overloaded (max util {u:.0%})."
        return self._dim("workload", s, r)

    def _resource(self, m) -> DimensionScore:
        over = m.get("overloaded_members", 0)
        team = max(1, m.get("team_size", 1))
        ratio = over / team
        s = 100 - ratio * 100
        return self._dim("resource", s, f"{over}/{team} members overloaded.")

    def _risk(self, m) -> DimensionScore:
        worst = m.get("open_risk_score", 0)  # 0..100
        s = 100 - worst
        return self._dim("risk", s, f"Worst open risk score {worst:.0f}/100.")

    def _dependency(self, m) -> DimensionScore:
        spof = m.get("spof_count", 0)
        density = m.get("dependency_density", 0.0)
        s = 100 - spof * 15 - max(0.0, density - 1.0) * 20
        return self._dim(
            "dependency", s, f"{spof} SPOF task(s), density {density:.2f}."
        )

    def _clarity(self, m) -> DimensionScore:
        c = m.get("requirement_completeness", 0.6)
        return self._dim(
            "requirement_clarity", c * 100, f"Intake completeness {c:.0%}."
        )

    def _delivery(self, m) -> DimensionScore:
        d = m.get("delivery_readiness", 0.6)
        return self._dim("delivery_readiness", d * 100, f"Delivery readiness {d:.0%}.")

    def _testing(self, m) -> DimensionScore:
        w = m.get("testing_window_days")
        if w is None:
            return self._dim("testing_readiness", 60, "No testing window data.")
        s = min(100, w / 5.0 * 100)  # 5+ days -> full marks
        return self._dim("testing_readiness", s, f"{w} day testing window.")

    def _stakeholder(self, m) -> DimensionScore:
        a = m.get("stakeholder_alignment", 0.7)
        return self._dim(
            "stakeholder_alignment", a * 100, f"Stakeholder alignment {a:.0%}."
        )

    def _documentation(self, m) -> DimensionScore:
        d = m.get("documentation_ratio", 0.6)
        return self._dim("documentation", d * 100, f"Documentation {d:.0%} complete.")

    def _demo(self, m) -> DimensionScore:
        d = m.get("demo_readiness", 0.6)
        return self._dim("demo_readiness", d * 100, f"Demo readiness {d:.0%}.")
