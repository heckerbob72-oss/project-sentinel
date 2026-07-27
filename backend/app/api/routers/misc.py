"""Remaining route groups: methodology, intake, reports, executive, meeting
minutes, explainability, portfolio, knowledge, lessons, audit, admin, users."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from ...agents import (
    ExecutiveCopilotAgent,
    ExplainabilityAgent,
    IntakeAgent,
    MeetingMinutesAgent,
    MethodologyAgent,
    ReportingAgent,
)
from ...core.audit import record_audit
from ...core.exceptions import SentinelError
from ...core.rbac import Permission, require_permission
from ...core.response import success
from ...models.audit import AuditLog
from ...models.knowledge import KnowledgeEdge, KnowledgeNode, LessonsLearned, PortfolioProject
from ...models.project import Project
from ...models.user import User
from ...schemas.planning import IntakeRequest
from ..deps import get_current_user, get_db

# ---- methodology ----
methodology_router = APIRouter(prefix="/methodology", tags=["methodology"])


@methodology_router.post("/recommend")
def recommend(profile: dict = Body(default={}), user=Depends(get_current_user)):
    r = MethodologyAgent().run({"profile": profile})
    return success(r.data, r.explanation.to_dict(), next_actions=r.next_actions)


# ---- intake ----
intake_router = APIRouter(prefix="/intake", tags=["intake"])


@intake_router.post("/{project_id}")
def submit_intake(project_id: int, body: IntakeRequest,
                  db: Session = Depends(get_db), user=Depends(get_current_user)):
    project = db.query(Project).get(project_id)
    if not project:
        raise SentinelError("not_found", "Project not found.", status_code=404)
    r = IntakeAgent().run({"profile": project.profile or {}, "answers": body.answers})
    project.profile = r.data["profile"]
    project.intake_completeness = r.data["completeness"]
    db.commit()
    return success(r.data, r.explanation.to_dict())


# ---- reports ----
reports_router = APIRouter(tags=["reports"])


@reports_router.post("/projects/{project_id}/reports")
def generate_report(project_id: int, report_type: str = Body(embed=True, default="weekly_status"),
                    db: Session = Depends(get_db),
                    user=Depends(require_permission(Permission.REPORT_GENERATE))):
    r = ReportingAgent().run({"report_type": report_type, "facts": {}})
    record_audit(db, action="report.generate", agent=r.agent, project_id=project_id,
                 user_id=user.id, explanation=r.explanation.to_dict())
    return success(r.data, r.explanation.to_dict())


# ---- executive copilot ----
exec_router = APIRouter(prefix="/executive", tags=["executive"])


@exec_router.post("/draft")
def exec_draft(payload: dict = Body(default={}), user=Depends(get_current_user)):
    r = ExecutiveCopilotAgent().run(payload)
    return success(r.data, r.explanation.to_dict(), next_actions=r.next_actions)


# ---- meeting minutes ----
minutes_router = APIRouter(prefix="/meeting-minutes", tags=["meeting-minutes"])


@minutes_router.post("/generate")
def gen_minutes(payload: dict = Body(default={}), user=Depends(get_current_user)):
    r = MeetingMinutesAgent().run(payload)
    return success(r.data, r.explanation.to_dict(), next_actions=r.next_actions)


# ---- explainability (Judge mode) ----
explain_router = APIRouter(prefix="/explainability", tags=["explainability"])


@explain_router.get("/{audit_id}")
def explain_audit(audit_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    entry = db.query(AuditLog).filter(AuditLog.audit_id == audit_id).first()
    if not entry:
        raise SentinelError("not_found", f"Audit record {audit_id} not found.", status_code=404)
    source_exp = {
        "reasoning": [],
        "evidence": entry.evidence, "rules_triggered": entry.rules_triggered,
        "calculations": entry.calculations, "confidence": entry.confidence,
        "alternatives": [],
    }
    r = ExplainabilityAgent().run({"subject": entry.action, "explanation": source_exp})
    return success(r.data, r.explanation.to_dict())


# ---- portfolio ----
portfolio_router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@portfolio_router.get("")
def portfolio(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = db.query(PortfolioProject).all()
    data = []
    for p in rows:
        project = db.query(Project).get(p.project_id)
        data.append({
            "project_id": p.project_id,
            "name": project.name if project else "",
            "health": p.health, "risk_level": p.risk_level, "progress": p.progress,
            "delivery_confidence": p.delivery_confidence, "rescue_mode": p.rescue_mode,
            "next_milestone": p.next_milestone,
        })
    return success(data)


# ---- knowledge graph ----
knowledge_router = APIRouter(prefix="/knowledge-graph", tags=["knowledge-graph"])


@knowledge_router.get("/{project_id}")
def knowledge(project_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    nodes = db.query(KnowledgeNode).filter(KnowledgeNode.project_id == project_id).all()
    edges = db.query(KnowledgeEdge).filter(KnowledgeEdge.project_id == project_id).all()
    return success({
        "nodes": [{"id": n.node_key, "type": n.node_type, "label": n.label,
                   "attributes": n.attributes} for n in nodes],
        "edges": [{"source": e.source_key, "target": e.target_key, "relation": e.relation}
                  for e in edges],
    })


# ---- lessons learned ----
lessons_router = APIRouter(prefix="/lessons-learned", tags=["lessons-learned"])


@lessons_router.get("")
def lessons(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = db.query(LessonsLearned).all()
    return success([{"category": l.category, "title": l.title, "detail": l.detail,
                     "recommendation": l.recommendation, "tags": l.tags} for l in rows])


# ---- audit ----
audit_router = APIRouter(prefix="/audit", tags=["audit"])


@audit_router.get("")
def audit_log(limit: int = 100, db: Session = Depends(get_db),
              user=Depends(require_permission(Permission.AUDIT_VIEW))):
    rows = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
    return success([{
        "audit_id": a.audit_id, "agent": a.agent, "action": a.action,
        "input_summary": a.input_summary, "output_summary": a.output_summary,
        "rules_triggered": a.rules_triggered, "confidence": a.confidence,
        "approval_status": a.approval_status, "created_at": a.created_at.isoformat(),
    } for a in rows])


# ---- admin / users ----
admin_router = APIRouter(prefix="/admin", tags=["admin"])


@admin_router.get("/users")
def admin_users(db: Session = Depends(get_db),
                user=Depends(require_permission(Permission.ADMIN_SETTINGS))):
    rows = db.query(User).filter(User.is_deleted.is_(False)).all()
    return success([{"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role}
                    for u in rows])


ALL_ROUTERS = [
    methodology_router, intake_router, reports_router, exec_router, minutes_router,
    explain_router, portfolio_router, knowledge_router, lessons_router,
    audit_router, admin_router,
]
