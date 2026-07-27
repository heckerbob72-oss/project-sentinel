"""Additional project-scoped endpoints that back the remaining UI pages:
team/members, methodology, project DNA, rescue mode, gap analysis, summary,
and report listing.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...agents import (
    GapDetectionAgent,
    HealthAgent,
    MethodologyAgent,
    ProjectDNAAgent,
    RescueAgent,
    RiskAgent,
    SuccessAgent,
)
from ...core.audit import record_audit
from ...core.exceptions import SentinelError
from ...core.response import success
from ...models.project import Project
from ...models.report import Report
from ...models.team import Member, MemberSkill, Skill
from ..deps import get_current_user, get_db
from .insight import derive_project_metrics
from .planning import _deps_for, _tasks_for

router = APIRouter(tags=["project-extra"])


def _project_or_404(db: Session, project_id: int) -> Project:
    p = db.query(Project).filter(Project.id == project_id, Project.is_deleted.is_(False)).first()
    if not p:
        raise SentinelError("not_found", f"Project {project_id} not found.", status_code=404)
    return p


@router.get("/projects/{project_id}/members")
def project_members(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    members = db.query(Member).filter(Member.project_id == project_id, Member.is_deleted.is_(False)).all()
    out = []
    for m in members:
        skills = {}
        for ms in db.query(MemberSkill).filter(MemberSkill.member_id == m.id).all():
            sk = db.get(Skill, ms.skill_id)
            if sk:
                skills[sk.name] = ms.proficiency
        out.append({"id": m.id, "name": m.name, "role": m.role, "email": m.email,
                    "capacity_hours": m.capacity_hours, "skills": skills})
    return success({"members": out})


@router.get("/projects/{project_id}/methodology")
def project_methodology(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    project = _project_or_404(db, project_id)
    r = MethodologyAgent().run({"profile": project.profile or {}})
    return success(r.data, r.explanation.to_dict(), next_actions=r.next_actions)


@router.get("/projects/{project_id}/dna")
def project_dna(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    project = _project_or_404(db, project_id)
    tasks = _tasks_for(db, project_id)
    deps = _deps_for(db, project_id)
    density = round(len(deps) / max(1, len(tasks)), 3)
    r = ProjectDNAAgent().run({"profile": project.profile or {}, "task_count": len(tasks),
                               "dependency_density": density})
    return success(r.data, r.explanation.to_dict(), next_actions=r.next_actions)


@router.get("/projects/{project_id}/gaps")
def project_gaps(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    project = _project_or_404(db, project_id)
    r = GapDetectionAgent().run({"facts": project.profile or {}})
    return success(r.data, r.explanation.to_dict(), next_actions=r.next_actions)


@router.get("/projects/{project_id}/rescue")
def project_rescue(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    metrics = derive_project_metrics(db, project_id)
    risks = RiskAgent().run({"metrics": metrics}).data["risks"]
    if risks:
        metrics["open_risk_score"] = max(r["score"] for r in risks)
    health = HealthAgent().run({"metrics": metrics}).data
    r = RescueAgent().run({"health": health, "risks": risks})
    audit_id = record_audit(db, action="rescue.evaluate", agent=r.agent, project_id=project_id,
                            explanation=r.explanation.to_dict())
    data = {**r.data, "health": health}
    return success(data, r.explanation.to_dict(), audit_id=audit_id, next_actions=r.next_actions)


@router.get("/projects/{project_id}/summary")
def project_summary(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    project = _project_or_404(db, project_id)
    metrics = derive_project_metrics(db, project_id)
    risks = RiskAgent().run({"metrics": metrics}).data["risks"]
    if risks:
        metrics["open_risk_score"] = max(r["score"] for r in risks)
    health = HealthAgent().run({"metrics": metrics}).data
    success_res = SuccessAgent().run({"metrics": metrics}).data
    data = {
        "project": {
            "id": project.id, "name": project.name, "objective": project.objective,
            "project_type": project.project_type, "methodology": project.methodology,
            "priority": project.priority, "status": project.status,
            "intake_completeness": project.intake_completeness,
        },
        "health": {"overall": health["overall"], "status": health["status"],
                   "rescue_recommended": health["rescue_recommended"]},
        "success_probability": success_res["probability"],
        "top_risks": risks[:3],
        "metrics": metrics,
    }
    return success(data)


@router.get("/projects/{project_id}/reports")
def project_reports(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = db.query(Report).filter(Report.project_id == project_id).order_by(Report.id.desc()).all()
    return success({
        "available_types": ["daily_status", "weekly_status", "stakeholder", "executive_summary",
                            "risk_report", "demo_readiness", "submission_readiness"],
        "reports": [{"id": r.id, "report_type": r.report_type, "title": r.title,
                     "body": r.body, "generated_by": r.generated_by,
                     "created_at": r.created_at.isoformat()} for r in rows],
    })
