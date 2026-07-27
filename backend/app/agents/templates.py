"""Work Breakdown Structure templates keyed by project type.

Templates keep WBS generation deterministic and grounded — the Work Breakdown
Agent selects a template and maps it to the project's deliverables rather than
hallucinating tasks. Each phase lists tasks with default PERT estimates (days)
and the skills they typically require.
"""
from __future__ import annotations

# effort tuple = (optimistic, most_likely, pessimistic) in days
_AI_APP = {
    "key": "ai_application",
    "name": "AI Application Project",
    "phases": [
        {"phase": "Requirement Analysis", "tasks": [
            {"title": "Elicit and confirm requirements", "effort": (1, 2, 4), "skills": ["analysis"]},
            {"title": "Define success & acceptance criteria", "effort": (1, 1, 2), "skills": ["analysis"]},
        ]},
        {"phase": "Solution Architecture", "tasks": [
            {"title": "Design system architecture", "effort": (2, 3, 5), "skills": ["architecture"]},
            {"title": "Select tech stack & data flow", "effort": (1, 2, 3), "skills": ["architecture"]},
        ]},
        {"phase": "Data Preparation", "tasks": [
            {"title": "Collect & clean data", "effort": (2, 4, 7), "skills": ["data"]},
            {"title": "Build ingestion pipeline", "effort": (2, 3, 6), "skills": ["data", "python"]},
        ]},
        {"phase": "Agent Design", "tasks": [
            {"title": "Design agent workflow", "effort": (2, 3, 5), "skills": ["ai", "architecture"]},
            {"title": "Define deterministic checks", "effort": (1, 2, 4), "skills": ["ai"]},
        ]},
        {"phase": "Model Integration", "tasks": [
            {"title": "Integrate LLM provider", "effort": (1, 2, 4), "skills": ["ai", "python"]},
        ]},
        {"phase": "Backend Development", "tasks": [
            {"title": "Build API endpoints", "effort": (3, 5, 8), "skills": ["python", "fastapi"]},
            {"title": "Implement data models & auth", "effort": (2, 3, 5), "skills": ["python", "security"]},
        ]},
        {"phase": "Frontend Development", "tasks": [
            {"title": "Build UI dashboards", "effort": (3, 5, 9), "skills": ["react", "typescript"]},
        ]},
        {"phase": "RAG Pipeline", "tasks": [
            {"title": "Implement retrieval + citations", "effort": (2, 3, 5), "skills": ["ai", "python"]},
        ]},
        {"phase": "Evaluation", "tasks": [
            {"title": "Define & run evaluations", "effort": (1, 2, 4), "skills": ["ai", "qa"]},
        ]},
        {"phase": "Testing", "tasks": [
            {"title": "Integration testing", "effort": (2, 3, 5), "skills": ["qa"]},
            {"title": "User acceptance testing", "effort": (1, 2, 4), "skills": ["qa"]},
        ]},
        {"phase": "Deployment", "tasks": [
            {"title": "Containerise & deploy", "effort": (1, 2, 4), "skills": ["devops"]},
        ]},
        {"phase": "Documentation", "tasks": [
            {"title": "Write user & technical docs", "effort": (1, 2, 3), "skills": ["writing"]},
        ]},
        {"phase": "Presentation Preparation", "tasks": [
            {"title": "Prepare demo & pitch", "effort": (1, 1, 3), "skills": ["comms"]},
        ]},
        {"phase": "Demo Readiness", "tasks": [
            {"title": "Dry-run & fallback demo", "effort": (1, 1, 2), "skills": ["comms", "qa"]},
        ]},
    ],
}

_WEB_APP = {
    "key": "web_application",
    "name": "Web Application Project",
    "phases": [
        {"phase": "Discovery", "tasks": [{"title": "Requirements & wireframes", "effort": (1, 2, 4), "skills": ["analysis", "ux"]}]},
        {"phase": "Design", "tasks": [{"title": "UI/UX design", "effort": (2, 3, 5), "skills": ["ux"]}]},
        {"phase": "Backend", "tasks": [{"title": "APIs & DB", "effort": (3, 5, 8), "skills": ["python", "sql"]}]},
        {"phase": "Frontend", "tasks": [{"title": "Build screens", "effort": (3, 5, 9), "skills": ["react"]}]},
        {"phase": "Testing", "tasks": [{"title": "QA & UAT", "effort": (2, 3, 5), "skills": ["qa"]}]},
        {"phase": "Deployment", "tasks": [{"title": "Release", "effort": (1, 2, 3), "skills": ["devops"]}]},
    ],
}

_HACKATHON = {
    "key": "hackathon",
    "name": "Hackathon Project",
    "phases": [
        {"phase": "Ideation", "tasks": [{"title": "Scope MVP", "effort": (0.25, 0.5, 1), "skills": ["analysis"]}]},
        {"phase": "Build", "tasks": [
            {"title": "Core feature build", "effort": (0.5, 1, 2), "skills": ["python", "react"]},
            {"title": "Integration", "effort": (0.25, 0.5, 1), "skills": ["python"]},
        ]},
        {"phase": "Test", "tasks": [{"title": "Smoke test", "effort": (0.25, 0.5, 1), "skills": ["qa"]}]},
        {"phase": "Pitch", "tasks": [{"title": "Slides & demo", "effort": (0.25, 0.5, 1), "skills": ["comms"]}]},
    ],
}

TEMPLATES: dict[str, dict] = {t["key"]: t for t in (_AI_APP, _WEB_APP, _HACKATHON)}


def get_template(project_type: str) -> dict:
    """Return the best-matching template, defaulting to the AI application one."""
    return TEMPLATES.get(project_type, _AI_APP)
