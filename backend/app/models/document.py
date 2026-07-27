"""Document ingestion and RAG source models."""
from __future__ import annotations

from sqlalchemy import JSON, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .base import SoftDeleteMixin, TimestampMixin


class Document(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(80), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    storage_path: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(30), default="uploaded")
    extracted_facts: Mapped[dict] = mapped_column(JSON, default=dict)


class DocumentChunk(Base, TimestampMixin):
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    chunk_id: Mapped[str] = mapped_column(String(80), index=True)
    ordinal: Mapped[int] = mapped_column(Integer, default=0)
    text: Mapped[str] = mapped_column(Text)
    page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    section: Mapped[str] = mapped_column(String(255), default="")
    embedding: Mapped[list] = mapped_column(JSON, default=list)


class DocumentSource(Base, TimestampMixin):
    __tablename__ = "document_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    chunk_id: Mapped[str] = mapped_column(String(80), index=True)
    citation: Mapped[str] = mapped_column(String(500))
    snippet: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
