"""Simulation and health-score models."""
from __future__ import annotations

from sqlalchemy import JSON, Boolean, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .base import TimestampMixin


class Simulation(Base, TimestampMixin):
    __tablename__ = "simulations"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    scenario: Mapped[str] = mapped_column(String(60), index=True)
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class SimulationResult(Base, TimestampMixin):
    __tablename__ = "simulation_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    simulation_id: Mapped[int] = mapped_column(ForeignKey("simulations.id", ondelete="CASCADE"), index=True)
    before_state: Mapped[dict] = mapped_column(JSON, default=dict)
    after_state: Mapped[dict] = mapped_column(JSON, default=dict)
    deltas: Mapped[dict] = mapped_column(JSON, default=dict)
    new_risks: Mapped[list] = mapped_column(JSON, default=list)
    explanation: Mapped[dict] = mapped_column(JSON, default=dict)


class HealthScore(Base, TimestampMixin):
    __tablename__ = "health_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    overall: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), index=True)
    rescue_recommended: Mapped[bool] = mapped_column(Boolean, default=False)
    dimensions: Mapped[list] = mapped_column(JSON, default=list)
    explanation: Mapped[dict] = mapped_column(JSON, default=dict)
