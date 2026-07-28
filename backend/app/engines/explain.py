"""
Shared explainability primitives used by every deterministic engine and agent.

Project Sentinel's core philosophy: no recommendation is ever a black box. Every
output carries a structured `Explanation` that answers:
  - What was recommended / computed?
  - Why (reasoning chain)?
  - What evidence supports it?
  - Which rules / formulas were triggered?
  - What calculations were performed?
  - How confident are we, and on what assumptions?

This module is pure Python (no framework deps) so it can be unit-tested and
reused inside engines, agents, and API responses.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any


def _utcnow() -> str:
    return datetime.now(UTC).isoformat()


@dataclass
class Evidence:
    """A single traceable fact backing a decision."""

    source: str  # e.g. "document:charter.pdf#p2", "task:T-07", "rule:RISK_SPOF"
    detail: str
    value: Any = None

    def to_dict(self) -> dict[str, Any]:
        return {"source": self.source, "detail": self.detail, "value": self.value}


@dataclass
class Calculation:
    """A named, reproducible calculation with inputs and result."""

    name: str
    formula: str
    inputs: dict[str, Any]
    result: Any

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "formula": self.formula,
            "inputs": self.inputs,
            "result": self.result,
        }


@dataclass
class Explanation:
    """
    The canonical explanation attached to any Sentinel output.

    `confidence` is on a 0..1 scale. For deterministic engines it is typically
    high (0.9-1.0) because outputs are computed, not guessed. LLM-assisted
    outputs carry lower confidence and MUST cite evidence.
    """

    summary: str
    reasoning: list[str] = field(default_factory=list)
    evidence: list[Evidence] = field(default_factory=list)
    rules_triggered: list[str] = field(default_factory=list)
    calculations: list[Calculation] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    alternatives: list[str] = field(default_factory=list)
    confidence: float = 1.0
    agent: str = "deterministic-engine"
    timestamp: str = field(default_factory=_utcnow)

    def add_reason(self, reason: str) -> Explanation:
        self.reasoning.append(reason)
        return self

    def add_evidence(self, source: str, detail: str, value: Any = None) -> Explanation:
        self.evidence.append(Evidence(source=source, detail=detail, value=value))
        return self

    def add_calc(self, calc: Calculation) -> Explanation:
        self.calculations.append(calc)
        return self

    def trigger(self, rule_id: str) -> Explanation:
        if rule_id not in self.rules_triggered:
            self.rules_triggered.append(rule_id)
        return self

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": self.summary,
            "reasoning": self.reasoning,
            "evidence": [e.to_dict() for e in self.evidence],
            "rules_triggered": self.rules_triggered,
            "calculations": [c.to_dict() for c in self.calculations],
            "assumptions": self.assumptions,
            "alternatives": self.alternatives,
            "confidence": round(self.confidence, 3),
            "agent": self.agent,
            "timestamp": self.timestamp,
        }
