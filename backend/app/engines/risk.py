"""
Risk Engine — deterministic, rule-based, evidence-backed. NO black-box scoring.

Rules are declared in `risk_rules.yaml`. Each rule maps a computable project
metric to a severity when a threshold is crossed. The engine:
  - loads rules from YAML
  - evaluates each rule against a `RiskContext` of computed metrics
  - emits a Risk with the triggered rule, evidence, score, and mitigation

Risk score = probability * impact, both on a 1..5 scale, normalised to 0..100.
Nothing here guesses; every risk points at the exact metric and threshold that
fired it.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

import yaml

from .explain import Calculation, Explanation

_DEFAULT_RULES = os.path.join(os.path.dirname(__file__), "risk_rules.yaml")

_SEVERITY_PROBABILITY = {"low": 2, "medium": 3, "high": 4, "critical": 5}
_SEVERITY_IMPACT = {"low": 2, "medium": 3, "high": 4, "critical": 5}

_OPS = {
    ">": lambda a, b: a > b,
    ">=": lambda a, b: a >= b,
    "<": lambda a, b: a < b,
    "<=": lambda a, b: a <= b,
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
}


@dataclass
class RiskContext:
    """Computed, deterministic project metrics used to evaluate risk rules."""

    metrics: dict[str, Any] = field(default_factory=dict)

    def get(self, key: str, default: Any = None) -> Any:
        return self.metrics.get(key, default)


@dataclass
class Risk:
    rule_id: str
    title: str
    category: str
    severity: str
    probability: int
    impact: int
    score: float  # 0..100
    evidence: list[dict]
    recommended_action: str
    explanation: Explanation

    def to_dict(self) -> dict:
        return {
            "rule_id": self.rule_id,
            "title": self.title,
            "category": self.category,
            "severity": self.severity,
            "probability": self.probability,
            "impact": self.impact,
            "score": round(self.score, 1),
            "evidence": self.evidence,
            "recommended_action": self.recommended_action,
            "explanation": self.explanation.to_dict(),
        }


class RiskEngine:
    def __init__(self, rules_path: str | None = None):
        self.rules_path = rules_path or _DEFAULT_RULES
        self.rules = self._load_rules(self.rules_path)

    def _load_rules(self, path: str) -> list[dict]:
        with open(path, "r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
        return data.get("rules", [])

    def evaluate(self, ctx: RiskContext) -> list[Risk]:
        risks: list[Risk] = []
        for rule in self.rules:
            metric = rule["condition"]["metric"]
            op = rule["condition"]["op"]
            threshold = rule["threshold"]
            actual = ctx.get(metric)
            if actual is None:
                continue  # metric not available -> cannot evaluate -> no false risk
            if op not in _OPS:
                continue
            if _OPS[op](actual, threshold):
                risks.append(self._build_risk(rule, metric, op, threshold, actual))
        # highest score first
        return sorted(risks, key=lambda r: r.score, reverse=True)

    def _build_risk(self, rule, metric, op, threshold, actual) -> Risk:
        severity = rule["severity"]
        probability = _SEVERITY_PROBABILITY[severity]
        impact = _SEVERITY_IMPACT[severity]
        score = (probability * impact) / 25.0 * 100.0

        exp = Explanation(
            summary=f"Risk '{rule['name']}' triggered ({severity}).",
            agent="risk-engine",
            confidence=1.0,
        )
        exp.trigger(rule["rule_id"])
        exp.add_reason(rule["rationale"])
        exp.add_reason(
            f"Rule condition: {metric} {op} {threshold}. "
            f"Observed {metric} = {actual}."
        )
        exp.add_evidence(
            source=f"rule:{rule['rule_id']}",
            detail=f"{metric} {op} {threshold} (observed {actual})",
            value=actual,
        )
        exp.add_calc(
            Calculation(
                name="risk_score",
                formula="(probability * impact) / 25 * 100",
                inputs={"probability": probability, "impact": impact},
                result=round(score, 1),
            )
        )

        return Risk(
            rule_id=rule["rule_id"],
            title=rule["name"],
            category=rule["category"],
            severity=severity,
            probability=probability,
            impact=impact,
            score=score,
            evidence=[
                {
                    "metric": metric,
                    "operator": op,
                    "threshold": threshold,
                    "observed": actual,
                }
            ],
            recommended_action=rule["recommended_action"],
            explanation=exp,
        )
