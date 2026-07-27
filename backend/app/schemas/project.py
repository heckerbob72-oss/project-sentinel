"""Project schemas."""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str = ""
    objective: str = ""
    project_type: str = "ai_application"
    methodology: str = "hybrid"
    priority: str = "medium"
    start_date: date | None = None
    deadline: date | None = None
    budget: float | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    objective: str | None = None
    project_type: str | None = None
    methodology: str | None = None
    priority: str | None = None
    status: str | None = None
    start_date: date | None = None
    deadline: date | None = None
    budget: float | None = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    objective: str
    project_type: str
    methodology: str
    priority: str
    status: str
    start_date: date | None = None
    deadline: date | None = None
    budget: float | None = None
    intake_completeness: float = 0.0

    class Config:
        from_attributes = True
