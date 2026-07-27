"""Reporting, meeting minutes, and action item models."""
from __future__ import annotations

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .base import TimestampMixin


class Report(Base, TimestampMixin):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    report_type: Mapped[str] = mapped_column(String(60), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text, default="")
    audience: Mapped[str] = mapped_column(String(60), default="team")
    generated_by: Mapped[str] = mapped_column(String(80), default="reporting-agent")
    explanation: Mapped[dict] = mapped_column(JSON, default=dict)


class MeetingMinutes(Base, TimestampMixin):
    __tablename__ = "meeting_minutes"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    attendees: Mapped[list] = mapped_column(JSON, default=list)
    summary: Mapped[str] = mapped_column(Text, default="")
    decisions: Mapped[list] = mapped_column(JSON, default=list)
    blockers: Mapped[list] = mapped_column(JSON, default=list)
    follow_up_questions: Mapped[list] = mapped_column(JSON, default=list)


class ActionItem(Base, TimestampMixin):
    __tablename__ = "action_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    minutes_id: Mapped[int | None] = mapped_column(ForeignKey("meeting_minutes.id", ondelete="SET NULL"), nullable=True)
    description: Mapped[str] = mapped_column(Text)
    owner: Mapped[str] = mapped_column(String(160), default="")
    due_date: Mapped[str] = mapped_column(String(30), default="")
    status: Mapped[str] = mapped_column(String(20), default="open")
    linked_task_ext_id: Mapped[str] = mapped_column(String(40), default="")
