"""Planning routes: WBS, dependencies, timeline, resources.

Provides both ad-hoc compute endpoints (POST with tasks in the body) and
project-scoped GET endpoints that load stored tasks/dependencies and run the
deterministic engines.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...agents import (
    DependencyAgent,
    ResourceAllocationAgent,
    TimelineAgent,
    WorkBreakdownAgent,
)
from ...core.audit import record_audit
from ...core.response import success
from ...models.team import Member, MemberSkill, Skill
from ...models.work import Task, TaskDependency, WBSItem
from ...schemas.planning import DependencyRequest, ScheduleRequest, WBSRequest
from ..deps import get_current_user, get_db

router = APIRouter(tags=["planning"])


def _tasks_for(db: Session, project_id: int) -> list[dict]:
    rows = db.query(Task).filter(Task.project_id == project_id, Task.is_deleted.is_(False)).all()
    return [
        {"id": t.ext_id, "label": t.title, "optimistic": t.optimistic,
         "most_likely": t.most_likely, "pessimistic": t.pessimistic,
         "required_skills": t.required_skills or [], "critical": t.is_critical}
        for t in rows
    ]


def _deps_for(db: Session, project_id: int) -> list[dict]:
    rows = db.query(TaskDependency).filter(TaskDependency.project_id == project_id).all()
    return [{"source": d.source_task, "target": d.target_task, "type": d.dependency_type,
             "reason": d.reason} for d in rows]


def _members_for(db: Session, project_id: int) -> list[dict]:
    members = db.query(Member).filter(Member.project_id == project_id, Member.is_deleted.is_(False)).all()
    out = []
    for m in members:
        skills = {}
        for ms in db.query(MemberSkill).filter(MemberSkill.member_id == m.id).all():
            skill = db.query(Skill).get(ms.skill_id)
            if skill:
                skills[skill.name] = ms.proficiency
        out.append({"id": str(m.id), "name": m.name, "skills": skills,
                    "capacity_hours": m.capacity_hours, "role": m.role})
    return out


# ---- ad-hoc compute endpoints ----

@router.post("/wbs")
def build_wbs(body: WBSRequest, user=Depends(get_current_user)):
    r = WorkBreakdownAgent().run(body.model_dump())
    return success(r.data, r.explanation.to_dict(), next_actions=r.next_actions)


@router.post("/dependencies")
def build_dependencies(body: DependencyRequest, user=Depends(get_current_user)):
    r = DependencyAgent().run({"tasks": [t.model_dump() for t in body.tasks],
                               "dependencies": [d.model_dump() for d in body.dependencies]})
    return success(r.data, r.explanation.to_dict(), next_actions=r.next_actions)


@router.post("/timeline")
def build_timeline(body: ScheduleRequest, user=Depends(get_current_user)):
    r = TimelineAgent().run({"tasks": [t.model_dump() for t in body.tasks],
                             "dependencies": [d.model_dump() for d in body.dependencies],
                             "deadline": body.deadline})
    return success(r.data, r.explanation.to_dict(), next_actions=r.next_actions)


# ---- project-scoped GETs (load stored data + compute) ----

@router.get("/projects/{project_id}/wbs")
def project_wbs(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    items = db.query(WBSItem).filter(WBSItem.project_id == project_id, WBSItem.is_deleted.is_(False)).all()
    data = [{"wbs_code": w.wbs_code, "ext_id": w.ext_id, "phase": w.phase, "title": w.title,
             "deliverable": w.deliverable, "estimated_effort": w.estimated_effort,
             "required_skills": w.required_skills, "explanation": w.explanation}
            for w in items]
    return success({"wbs_items": data})


@router.get("/projects/{project_id}/dependencies")
def project_dependencies(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    r = DependencyAgent().run({"tasks": _tasks_for(db, project_id), "dependencies": _deps_for(db, project_id)})
    return success(r.data, r.explanation.to_dict(), next_actions=r.next_actions)


@router.get("/projects/{project_id}/timeline")
def project_timeline(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    from ...models.project import Project
    project = db.query(Project).get(project_id)
    deadline = None
    if project and project.start_date and project.deadline:
        deadline = (project.deadline - project.start_date).days
    r = TimelineAgent().run({"tasks": _tasks_for(db, project_id),
                             "dependencies": _deps_for(db, project_id), "deadline": deadline})
    return success(r.data, r.explanation.to_dict(), next_actions=r.next_actions)


@router.get("/projects/{project_id}/resources")
def project_resources(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    r = ResourceAllocationAgent().run({"tasks": _tasks_for(db, project_id),
                                       "members": _members_for(db, project_id)})
    record_audit(db, action="resources.allocate", agent=r.agent, project_id=project_id,
                 explanation=r.explanation.to_dict())
    return success(r.data, r.explanation.to_dict(), next_actions=r.next_actions)
