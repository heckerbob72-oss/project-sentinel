"""SQLAlchemy engine, session factory, and declarative Base."""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

_connect_args = {}
if settings.database_url.startswith("sqlite"):
    # Needed for SQLite when used across FastAPI threads.
    _connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables (used for local/sqlite bootstrap and tests)."""
    from . import models  # noqa: F401  ensures models are registered

    Base.metadata.create_all(bind=engine)
