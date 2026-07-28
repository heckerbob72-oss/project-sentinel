"""Work breakdown, tasks, dependencies, allocations, and milestones."""
from __future__ import annotations

from sqlalchemy import JSON, Boolean, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .base import SoftDeleteMixin, TimestampMixin


class WBSItem(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "wbs_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    wbs_code: Mapped[str] = mapped_column(String(40), index=True)
    ext_id: Mapped[str] = mapped_column(String(40), index=True, default="")
    phase: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    deliverable: Mapped[str] = mapped_column(String(255), default="")
    estimated_effort: Mapped[float] = mapped_column(Float, default=0.0)
    required_skills: Mapped[list] = mapped_column(JSON, default=list)
    acceptance_criteria: Mapped[str] = mapped_column(Text, default="")
    template_source: Mapped[str] = mapped_column(String(120), default="")
    explanation: Mapped[dict] = mapped_column(JSON, default=dict)


class Task(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    wbs_item_id: Mapped[int | None] = mapped_column(ForeignKey("wbs_items.id", ondelete="SET NULL"), nullable=True)
    ext_id: Mapped[str] = mapped_column(String(40), index=True)  # e.g. "T-07" used by engines
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(30), default="todo", index=True)
    optimistic: Mapped[float] = mapped_column(Float, default=1.0)
    most_likely: Mapped[float] = mapped_column(Float, default=1.0)
    pessimistic: Mapped[float] = mapped_column(Float, default=1.0)
    duration: Mapped[float] = mapped_column(Float, default=0.0)
    earliest_start: Mapped[float] = mapped_column(Float, default=0.0)
    earliest_finish: Mapped[float] = mapped_column(Float, default=0.0)
    total_float: Mapped[float] = mapped_column(Float, default=0.0)
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False)
    required_skills: Mapped[list] = mapped_column(JSON, default=list)


class TaskDependency(Base, TimestampMixin):
    __tablename__ = "task_dependencies"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    source_task: Mapped[str] = mapped_column(String(40), index=True)
    target_task: Mapped[str] = mapped_column(String(40), index=True)
    dependency_type: Mapped[str] = mapped_column(String(30), default="finish_to_start")
    reason: Mapped[str] = mapped_column(Text, default="")


class Allocation(Base, TimestampMixin):
    __tablename__ = "allocations"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    task_ext_id: Mapped[str] = mapped_column(String(40), index=True)
    member_id: Mapped[int | None] = mapped_column(ForeignKey("members.id", ondelete="SET NULL"), nullable=True)
    hours: Mapped[float] = mapped_column(Float, default=0.0)
    skill_match: Mapped[float] = mapped_column(Float, default=0.0)
    backup_member_id: Mapped[int | None] = mapped_column(ForeignKey("members.id", ondelete="SET NULL"), nullable=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    approval_status: Mapped[str] = mapped_column(String(20), default="suggested")


class Milestone(Base, TimestampMixin):
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    due_day: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    description: Mapped[str] = mapped_column(Text, default="")
