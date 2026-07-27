"""Risk, risk-rule, mitigation, and recovery-plan models."""
from __future__ import annotations

from sqlalchemy import JSON, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .base import TimestampMixin


class RiskRule(Base, TimestampMixin):
    __tablename__ = "risk_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    rule_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(80), index=True)
    severity: Mapped[str] = mapped_column(String(20))
    condition_metric: Mapped[str] = mapped_column(String(80))
    condition_op: Mapped[str] = mapped_column(String(8))
    threshold: Mapped[float] = mapped_column(Float)
    rationale: Mapped[str] = mapped_column(Text, default="")
    recommended_action: Mapped[str] = mapped_column(Text, default="")


class Risk(Base, TimestampMixin):
    __tablename__ = "risks"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    rule_id: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(80), index=True)
    severity: Mapped[str] = mapped_column(String(20), index=True)
    probability: Mapped[int] = mapped_column(Integer, default=3)
    impact: Mapped[int] = mapped_column(Integer, default=3)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    evidence: Mapped[list] = mapped_column(JSON, default=list)
    recommended_action: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    explanation: Mapped[dict] = mapped_column(JSON, default=dict)


class Mitigation(Base, TimestampMixin):
    __tablename__ = "mitigations"

    id: Mapped[int] = mapped_column(primary_key=True)
    risk_id: Mapped[int] = mapped_column(ForeignKey("risks.id", ondelete="CASCADE"), index=True)
    action: Mapped[str] = mapped_column(Text)
    owner: Mapped[str] = mapped_column(String(160), default="")
    expected_reduction: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="proposed")


class RecoveryPlan(Base, TimestampMixin):
    __tablename__ = "recovery_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    trigger: Mapped[str] = mapped_column(String(200), default="")
    actions: Mapped[list] = mapped_column(JSON, default=list)
    tasks_to_protect: Mapped[list] = mapped_column(JSON, default=list)
    tasks_to_defer: Mapped[list] = mapped_column(JSON, default=list)
    escalation: Mapped[str] = mapped_column(Text, default="")
    success_probability_after: Mapped[float] = mapped_column(Float, default=0.0)
    approval_status: Mapped[str] = mapped_column(String(20), default="suggested")
    explanation: Mapped[dict] = mapped_column(JSON, default=dict)
