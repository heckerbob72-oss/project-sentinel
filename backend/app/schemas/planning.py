"""Planning-related request schemas (WBS, schedule, dependency, simulation, intake)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class WBSRequest(BaseModel):
    project_type: str = "ai_application"
    deliverables: list[str] = []


class TaskInput(BaseModel):
    id: str
    label: str
    optimistic: float = 1.0
    most_likely: float = 1.0
    pessimistic: float = 1.0
    required_skills: list[str] = []
    critical: bool = False


class DependencyInput(BaseModel):
    source: str
    target: str
    type: str = "finish_to_start"
    reason: str = ""


class ScheduleRequest(BaseModel):
    tasks: list[TaskInput]
    dependencies: list[DependencyInput] = []
    deadline: float | None = None


class DependencyRequest(BaseModel):
    tasks: list[TaskInput]
    dependencies: list[DependencyInput] = []


class SimulationRequest(BaseModel):
    scenario: str = Field(description="e.g. task_delayed, deadline_shortened")
    params: dict[str, Any] = {}


class IntakeRequest(BaseModel):
    answers: dict[str, Any] = {}


class MemberInput(BaseModel):
    name: str
    role: str = "Contributor"
    email: str = ""
    capacity_hours: float = 40.0
    skills: dict[str, int] = {}


class GitHubImportRequest(BaseModel):
    repo_url: str = Field(min_length=3, description="e.g. https://github.com/owner/repo")


class TextImportRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)


class GeneratePlanRequest(BaseModel):
    """Final answers to merge before turning the intake profile into a plan."""
    answers: dict[str, Any] = {}
