"""initial schema

Bootstraps the full Project Sentinel schema from the declarative metadata.

For rapid iteration this initial revision creates every table from the ORM
models (all 40 tables). Subsequent schema changes should be captured with
`alembic revision --autogenerate` for reviewable, incremental DDL.

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-01
"""
from alembic import op

from app.database import Base
from app import models  # noqa: F401  ensure all models are registered

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
