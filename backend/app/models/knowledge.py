"""Knowledge graph, lessons learned, and portfolio models."""
from __future__ import annotations

from sqlalchemy import JSON, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .base import TimestampMixin


class KnowledgeNode(Base, TimestampMixin):
    __tablename__ = "knowledge_nodes"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    node_key: Mapped[str] = mapped_column(String(120), index=True)
    node_type: Mapped[str] = mapped_column(String(60), index=True)  # project|risk|task|person|...
    label: Mapped[str] = mapped_column(String(255))
    attributes: Mapped[dict] = mapped_column(JSON, default=dict)


class KnowledgeEdge(Base, TimestampMixin):
    __tablename__ = "knowledge_edges"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    source_key: Mapped[str] = mapped_column(String(120), index=True)
    target_key: Mapped[str] = mapped_column(String(120), index=True)
    relation: Mapped[str] = mapped_column(String(80))  # supports|causes|owns|depends_on|...
    attributes: Mapped[dict] = mapped_column(JSON, default=dict)


class LessonsLearned(Base, TimestampMixin):
    __tablename__ = "lessons_learned"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    category: Mapped[str] = mapped_column(String(80), index=True)  # went_well|went_wrong|...
    title: Mapped[str] = mapped_column(String(255))
    detail: Mapped[str] = mapped_column(Text, default="")
    recommendation: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)


class PortfolioProject(Base, TimestampMixin):
    __tablename__ = "portfolio_projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, unique=True)
    health: Mapped[float] = mapped_column(Float, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(20), default="low")
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    delivery_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    rescue_mode: Mapped[str] = mapped_column(String(20), default="inactive")
    next_milestone: Mapped[str] = mapped_column(String(200), default="")
