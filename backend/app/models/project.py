"""Project, Project DNA, methodology, and template models."""
from __future__ import annotations

from sqlalchemy import JSON, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .base import SoftDeleteMixin, TimestampMixin


class Project(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    objective: Mapped[str] = mapped_column(Text, default="")
    project_type: Mapped[str] = mapped_column(String(80), default="ai_application")
    methodology: Mapped[str] = mapped_column(String(40), default="hybrid")
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(String(30), default="planning", index=True)
    start_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    deadline: Mapped[str | None] = mapped_column(Date, nullable=True)
    budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    intake_completeness: Mapped[float] = mapped_column(Float, default=0.0)
    profile: Mapped[dict] = mapped_column(JSON, default=dict)

    dna: Mapped["ProjectDNA"] = relationship(back_populates="project", uselist=False)


class ProjectDNA(Base, TimestampMixin):
    __tablename__ = "project_dna"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    project_type: Mapped[str] = mapped_column(String(80), default="")
    methodology: Mapped[str] = mapped_column(String(40), default="")
    complexity: Mapped[str] = mapped_column(String(20), default="medium")
    risk_tolerance: Mapped[str] = mapped_column(String(20), default="medium")
    team_size: Mapped[int] = mapped_column(Integer, default=0)
    delivery_speed: Mapped[str] = mapped_column(String(20), default="standard")
    technology_stack: Mapped[list] = mapped_column(JSON, default=list)
    domain: Mapped[str] = mapped_column(String(120), default="")
    dependency_density: Mapped[float] = mapped_column(Float, default=0.0)
    documentation_level: Mapped[str] = mapped_column(String(20), default="medium")
    testing_intensity: Mapped[str] = mapped_column(String(20), default="medium")
    innovation_level: Mapped[str] = mapped_column(String(20), default="medium")
    stakeholder_involvement: Mapped[str] = mapped_column(String(20), default="medium")
    fingerprint: Mapped[dict] = mapped_column(JSON, default=dict)

    project: Mapped[Project] = relationship(back_populates="dna")


class ProjectMethod(Base, TimestampMixin):
    __tablename__ = "project_methods"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    recommended: Mapped[str] = mapped_column(String(40))
    ceremonies: Mapped[list] = mapped_column(JSON, default=list)
    artefacts: Mapped[list] = mapped_column(JSON, default=list)
    reporting_style: Mapped[str] = mapped_column(String(120), default="")
    pmbok_mapping: Mapped[dict] = mapped_column(JSON, default=dict)
    explanation: Mapped[dict] = mapped_column(JSON, default=dict)


class ProjectTemplate(Base, TimestampMixin):
    __tablename__ = "project_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    project_type: Mapped[str] = mapped_column(String(80), index=True)
    phases: Mapped[list] = mapped_column(JSON, default=list)
    description: Mapped[str] = mapped_column(Text, default="")
