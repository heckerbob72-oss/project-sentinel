"""
Project Success Probability Calculator — transparent weighted scoring.

This is deliberately NOT machine learning. It is a fully explainable weighted
model where every factor's contribution is visible. Total weights sum to 100.

Factors and max points:
  schedule feasibility ....... 25
  resource availability ...... 20
  risk exposure .............. 20
  dependency complexity ...... 15
  requirement clarity ........ 10
  testing readiness .......... 10
"""
from __future__ import annotations

from dataclasses import dataclass

from .explain import Calculation, Explanation

FACTOR_WEIGHTS = {
    "schedule_feasibility": 25,
    "resource_availability": 20,
    "risk_exposure": 20,
    "dependency_complexity": 15,
    "requirement_clarity": 10,
    "testing_readiness": 10,
}


@dataclass
class FactorScore:
    name: str
    points: float
    max_points: int
    note: str

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "points": round(self.points, 1),
            "max_points": self.max_points,
            "note": self.note,
        }


@dataclass
class SuccessResult:
    probability: float  # 0..100
    factors: list[FactorScore]
    strongest_positive: list[str]
    strongest_negative: list[str]
    improvement_actions: list[str]
    explanation: Explanation

    def to_dict(self) -> dict:
        return {
            "probability": round(self.probability, 1),
            "factors": [f.to_dict() for f in self.factors],
            "strongest_positive": self.strongest_positive,
            "strongest_negative": self.strongest_negative,
            "improvement_actions": self.improvement_actions,
            "explanation": self.explanation.to_dict(),
        }


class SuccessProbabilityCalculator:
    def calculate(self, metrics: dict) -> SuccessResult:
        factors: list[FactorScore] = []

        # schedule feasibility (25): full points at pressure<=0.8, 0 at >=1.5
        p = metrics.get("schedule_pressure", 1.0)
        sched = self._ramp(p, good=0.8, bad=1.5, max_pts=25, invert=True)
        factors.append(FactorScore("schedule_feasibility", sched, 25,
                                   f"schedule pressure {p:.2f}"))

        # resource availability (20): based on max utilisation
        u = metrics.get("max_utilisation", 0.8)
        res = self._ramp(u, good=0.85, bad=1.3, max_pts=20, invert=True)
        factors.append(FactorScore("resource_availability", res, 20,
                                   f"max utilisation {u:.0%}"))

        # risk exposure (20): 20 - worst_risk_score scaled
        worst = metrics.get("open_risk_score", 0)  # 0..100
        risk = max(0.0, 20 * (1 - worst / 100.0))
        factors.append(FactorScore("risk_exposure", risk, 20,
                                   f"worst open risk {worst:.0f}/100"))

        # dependency complexity (15): penalise density + SPOF
        density = metrics.get("dependency_density", 1.0)
        spof = metrics.get("spof_count", 0)
        dep = max(0.0, 15 - max(0.0, density - 1.0) * 10 - spof * 3)
        factors.append(FactorScore("dependency_complexity", dep, 15,
                                   f"density {density:.2f}, {spof} SPOF"))

        # requirement clarity (10)
        c = metrics.get("requirement_completeness", 0.6)
        clar = c * 10
        factors.append(FactorScore("requirement_clarity", clar, 10,
                                   f"intake {c:.0%} complete"))

        # testing readiness (10): 5+ day window -> full
        w = metrics.get("testing_window_days", 3)
        test = min(10.0, w / 5.0 * 10)
        factors.append(FactorScore("testing_readiness", test, 10,
                                   f"{w}-day testing window"))

        probability = sum(f.points for f in factors)

        def ratio(factor: FactorScore) -> float:
            return factor.points / factor.max_points if factor.max_points else 0

        pos = sorted(factors, key=ratio, reverse=True)[:2]
        neg = sorted(factors, key=ratio)[:2]

        improvements = self._improvements(neg)

        exp = Explanation(
            summary=f"Success probability = {probability:.0f}%.",
            agent="success-calculator",
            confidence=1.0,
        )
        exp.add_reason(
            "Transparent weighted model (not ML). Each factor contributes points "
            "up to its weight; probability is the sum."
        )
        for f in factors:
            exp.add_calc(
                Calculation(
                    name=f"factor:{f.name}",
                    formula=f"0..{f.max_points} from {f.note}",
                    inputs={"note": f.note},
                    result=round(f.points, 1),
                )
            )
        exp.add_calc(
            Calculation(
                name="success_probability",
                formula="sum(factor.points)",
                inputs={"factors": len(factors)},
                result=round(probability, 1),
            )
        )
        exp.add_reason(
            f"Strongest positives: {', '.join(f.name for f in pos)}; "
            f"weakest: {', '.join(f.name for f in neg)}."
        )

        return SuccessResult(
            probability=probability,
            factors=factors,
            strongest_positive=[f.name for f in pos],
            strongest_negative=[f.name for f in neg],
            improvement_actions=improvements,
            explanation=exp,
        )

    @staticmethod
    def _ramp(value, good, bad, max_pts, invert=False):
        """Linear ramp. If invert, higher value is worse."""
        if invert:
            if value <= good:
                return float(max_pts)
            if value >= bad:
                return 0.0
            return max_pts * (1 - (value - good) / (bad - good))
        else:
            if value >= good:
                return float(max_pts)
            if value <= bad:
                return 0.0
            return max_pts * (value - bad) / (good - bad)

    @staticmethod
    def _improvements(weak_factors) -> list[str]:
        mapping = {
            "schedule_feasibility": "Cut non-critical scope or add capacity to the critical path.",
            "resource_availability": "Rebalance workload away from overloaded members.",
            "risk_exposure": "Action the top open risks with mitigation plans.",
            "dependency_complexity": "Decouple tasks and add backups for SPOF nodes.",
            "requirement_clarity": "Close intake gaps before baselining the plan.",
            "testing_readiness": "Front-load testing to widen the test window.",
        }
        return [mapping[f.name] for f in weak_factors if f.name in mapping]
