"""Shared schema fragments for the explainable response envelope."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class EvidenceOut(BaseModel):
    source: str
    detail: str
    value: Any = None


class CalculationOut(BaseModel):
    name: str
    formula: str
    inputs: dict[str, Any]
    result: Any


class ExplanationOut(BaseModel):
    summary: str = ""
    reasoning: list[str] = []
    evidence: list[EvidenceOut] = []
    rules_triggered: list[str] = []
    calculations: list[CalculationOut] = []
    assumptions: list[str] = []
    alternatives: list[str] = []
    confidence: float = 1.0
    agent: str = "deterministic-engine"
    timestamp: str | None = None


class NextActionOut(BaseModel):
    action: str
    reason: str
    priority: str
    module: str


class Envelope(BaseModel):
    status: str = "success"
    data: Any = None
    explanation: ExplanationOut | None = None
    audit_id: str | None = None
    next_actions: list[NextActionOut] = []
