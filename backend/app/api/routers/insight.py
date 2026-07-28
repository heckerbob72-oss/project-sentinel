"""Risk, health, and success-probability routes (project insight)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...agents import HealthAgent, RecoveryAgent, RiskAgent, SuccessAgent
from ...core.audit import record_audit
from ...core.response import success
from ...engines import DependencyEngine, SchedulingEngine
from ...models.project import Project
from ..deps import get_current_user, get_db
from .planning import _deps_for, _members_for, _tasks_for

router = APIRouter(tags=["insight"])


def derive_project_metrics(db: Session, project_id: int) -> dict:
    """Compute deterministic risk/health metrics from stored project data."""
    tasks = _tasks_for(db, project_id)
    deps = _deps_for(db, project_id)
    members = _members_for(db, project_id)
    project = db.get(Project, project_id)

    deadline = None
    if project and project.start_date and project.deadline:
        deadline = (project.deadline - project.start_date).days

    metrics: dict = {"team_size": len(members)}
    if tasks:
        sched = SchedulingEngine().schedule(tasks, deps, deadline)
        metrics["schedule_pressure"] = sched.schedule_pressure
        metrics["deadline_feasible"] = 1 if sched.deadline_feasible in (True, None) else 0
        dep = DependencyEngine().build(tasks, deps)
        metrics["spof_count"] = len(dep.single_points_of_failure)
        metrics["dependency_density"] = round(len(deps) / max(1, len(tasks)), 3)
    if members:
        from ...engines import ResourceEngine
        alloc = ResourceEngine().allocate(tasks, members)
        util = alloc.utilisation
        metrics["max_utilisation"] = max(util.values()) if util else 0.0
        metrics["overloaded_members"] = len(alloc.overloaded_members)
        metrics["unassigned_tasks"] = len(alloc.unassigned_tasks)
        metrics["skill_gap_count"] = len(alloc.skill_gaps)
    if project:
        metrics["requirement_completeness"] = project.intake_completeness or 0.6
    return {k: v for k, v in metrics.items() if v is not None}


@router.get("/projects/{project_id}/risks")
def project_risks(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    metrics = derive_project_metrics(db, project_id)
    r = RiskAgent().run({"metrics": metrics})
    audit_id = record_audit(db, action="risk.evaluate", agent=r.agent, project_id=project_id,
                            explanation=r.explanation.to_dict())
    return success(r.data, r.explanation.to_dict(), audit_id=audit_id, next_actions=r.next_actions)


@router.get("/projects/{project_id}/health")
def project_health(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    metrics = derive_project_metrics(db, project_id)
    risks = RiskAgent().run({"metrics": metrics}).data["risks"]
    if risks:
        metrics["open_risk_score"] = max(r["score"] for r in risks)
    r = HealthAgent().run({"metrics": metrics})
    audit_id = record_audit(db, action="health.score", agent=r.agent, project_id=project_id,
                            explanation=r.explanation.to_dict())
    return success(r.data, r.explanation.to_dict(), audit_id=audit_id, next_actions=r.next_actions)


@router.get("/projects/{project_id}/success")
def project_success(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    metrics = derive_project_metrics(db, project_id)
    risks = RiskAgent().run({"metrics": metrics}).data["risks"]
    if risks:
        metrics["open_risk_score"] = max(r["score"] for r in risks)
    r = SuccessAgent().run({"metrics": metrics})
    return success(r.data, r.explanation.to_dict(), next_actions=r.next_actions)


@router.get("/projects/{project_id}/recovery")
def project_recovery(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    metrics = derive_project_metrics(db, project_id)
    risks = RiskAgent().run({"metrics": metrics}).data["risks"]
    r = RecoveryAgent().run({"risks": risks})
    audit_id = record_audit(db, action="recovery.plan", agent=r.agent, project_id=project_id,
                            explanation=r.explanation.to_dict(), approval_status="suggested")
    return success(r.data, r.explanation.to_dict(), audit_id=audit_id, next_actions=r.next_actions)
