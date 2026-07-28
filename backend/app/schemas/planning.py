"""Planning-related request schemas (WBS, schedule, dependency, simulation, intake)."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


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
    scenario: Literal[
        "member_unavailable",
        "deadline_shortened",
        "task_delayed",
        "add_requirement",
        "scope_reduced",
        "dependency_blocked",
        "testing_extended",
        "capacity_increased",
    ]
    params: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_scenario_params(self) -> SimulationRequest:
        if self.scenario in {"task_delayed", "dependency_blocked"}:
            if not str(self.params.get("task_id", "")).strip():
                raise ValueError(f"{self.scenario} requires a task_id")

        numeric_fields = {
            "deadline_shortened": ("days",),
            "task_delayed": ("days",),
            "dependency_blocked": ("block_days",),
            "testing_extended": ("days", "window"),
        }.get(self.scenario, ())
        for field_name in numeric_fields:
            value = self.params.get(field_name)
            if value is not None and (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or value < 0
            ):
                raise ValueError(f"{field_name} must be a non-negative number")
        return self


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
