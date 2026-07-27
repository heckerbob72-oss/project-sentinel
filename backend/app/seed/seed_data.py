"""Idempotent seed routine: roles, users, a sample project, team, WBS, tasks,
dependencies, risks, portfolio, lessons, and audit records.

Run with:  python -m app.seed.run_seed
All data is realistic but fictional.
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..core.rbac import ROLE_PERMISSIONS, Permission, Role
from ..core.security import hash_password
from ..database import SessionLocal, init_db
from ..models.audit import AuditLog
from ..models.knowledge import KnowledgeEdge, KnowledgeNode, LessonsLearned, PortfolioProject
from ..models.project import Project
from ..models.risk import RiskRule
from ..models.team import Member, MemberSkill, Skill
from ..models.user import Permission as PermissionModel
from ..models.user import Role as RoleModel
from ..models.user import User
from ..models.work import Task, TaskDependency, WBSItem
from .sample_documents import HACKATHON_BRIEF

SEED_USERS = [
    ("admin@sentinel.dev", "Ava Admin", "Admin", "admin123"),
    ("pm@sentinel.dev", "Priya Manager", "ProjectManager", "pm123456"),
    ("lead@sentinel.dev", "Leo Lead", "TeamLead", "lead1234"),
    ("dev@sentinel.dev", "Dana Dev", "Contributor", "dev12345"),
    ("view@sentinel.dev", "Val Viewer", "Viewer", "view1234"),
]

TEAM = [
    ("Asha Rao", "Backend Engineer", 40, {"python": 5, "fastapi": 4, "security": 3}),
    ("Ben Cole", "Frontend Engineer", 40, {"react": 5, "typescript": 4, "ux": 3}),
    ("Chen Li", "AI Engineer", 40, {"ai": 5, "python": 4, "data": 3}),
    ("Dev Shah", "Designer / QA", 32, {"ux": 4, "qa": 4, "writing": 3}),
]


def seed(db: Session) -> None:
    _seed_roles_permissions(db)
    _seed_users(db)
    _seed_risk_rules(db)
    project = _seed_project(db)
    _seed_team(db, project)
    _seed_wbs_and_tasks(db, project)
    _seed_risks_portfolio_lessons(db, project)
    _seed_extra_projects(db)
    db.commit()


def _seed_roles_permissions(db: Session) -> None:
    for perm in Permission:
        if not db.query(PermissionModel).filter_by(code=perm.value).first():
            db.add(PermissionModel(code=perm.value, description=perm.name))
    for role in Role:
        if not db.query(RoleModel).filter_by(name=role.value).first():
            db.add(RoleModel(name=role.value,
                             description=f"{role.value} — {len(ROLE_PERMISSIONS[role])} permissions"))
    db.flush()


def _seed_users(db: Session) -> None:
    for email, name, role, pw in SEED_USERS:
        if not db.query(User).filter_by(email=email).first():
            db.add(User(email=email, full_name=name, role=role,
                        hashed_password=hash_password(pw)))
    db.flush()


def _seed_risk_rules(db: Session) -> None:
    import os

    import yaml

    path = os.path.join(os.path.dirname(__file__), "..", "engines", "risk_rules.yaml")
    with open(path, encoding="utf-8") as fh:
        rules = (yaml.safe_load(fh) or {}).get("rules", [])
    for r in rules:
        if not db.query(RiskRule).filter_by(rule_id=r["rule_id"]).first():
            db.add(RiskRule(
                rule_id=r["rule_id"], name=r["name"], category=r["category"],
                severity=r["severity"], condition_metric=r["condition"]["metric"],
                condition_op=r["condition"]["op"], threshold=float(r["threshold"]),
                rationale=r.get("rationale", ""), recommended_action=r.get("recommended_action", ""),
            ))
    db.flush()


def _seed_project(db: Session) -> Project:
    project = db.query(Project).filter_by(name="Project Sentinel Demo").first()
    if project:
        return project
    owner = db.query(User).filter_by(email="pm@sentinel.dev").first()
    start = date(2026, 8, 1)
    project = Project(
        name="Project Sentinel Demo",
        description="Agentic AI project co-ordinator hackathon build.",
        objective="Deliver an explainable AI planning assistant by the deadline.",
        project_type="hackathon", methodology="scrum", priority="high",
        status="planning", start_date=start, deadline=start + timedelta(days=9),
        budget=0.0, owner_id=owner.id if owner else None,
        intake_completeness=0.85,
        profile={"project_type": "hackathon", "team_size": 4, "risk_tolerance": "medium",
                 "requirements_stability": 0.4, "change_frequency": "high",
                 "deliverables": ["backend API", "dashboard", "workflow", "demo"]},
    )
    db.add(project)
    db.flush()
    return project


def _seed_team(db: Session, project: Project) -> None:
    if db.query(Member).filter_by(project_id=project.id).first():
        return
    skill_cache: dict[str, Skill] = {}
    for name, role, cap, skills in TEAM:
        member = Member(project_id=project.id, name=name, role=role, capacity_hours=cap,
                        email=name.lower().replace(" ", ".") + "@sentinel.dev")
        db.add(member)
        db.flush()
        for skill_name, level in skills.items():
            skill = skill_cache.get(skill_name)
            if not skill:
                skill = db.query(Skill).filter_by(name=skill_name).first() or Skill(name=skill_name)
                db.add(skill)
                db.flush()
                skill_cache[skill_name] = skill
            db.add(MemberSkill(member_id=member.id, skill_id=skill.id, proficiency=level))
    db.flush()


def _seed_wbs_and_tasks(db: Session, project: Project) -> None:
    if db.query(Task).filter_by(project_id=project.id).first():
        return
    # A compact hackathon plan (durations in days).
    plan = [
        ("1.1", "T-01", "Ideation", "Scope MVP", (0.25, 0.5, 1), ["analysis"]),
        ("2.1", "T-02", "Build", "Backend API", (1, 2, 4), ["python", "fastapi"]),
        ("2.2", "T-03", "Build", "Frontend dashboard", (1, 2, 5), ["react", "typescript"]),
        ("2.3", "T-04", "Build", "Agent workflow", (1, 2, 3), ["ai", "python"]),
        ("3.1", "T-05", "Test", "Integration testing", (0.5, 1, 2), ["qa"]),
        ("4.1", "T-06", "Pitch", "Demo & slides", (0.25, 0.5, 1), ["comms", "ux"]),
    ]
    for code, ext, phase, title, eff, skills in plan:
        o, m, p = eff
        db.add(WBSItem(project_id=project.id, wbs_code=code, ext_id=ext, phase=phase,
                       title=title, deliverable=phase, estimated_effort=m,
                       required_skills=skills, template_source="hackathon",
                       explanation=f"Standard '{phase}' task for a hackathon project."))
        db.add(Task(project_id=project.id, ext_id=ext, title=title, optimistic=o,
                    most_likely=m, pessimistic=p, required_skills=skills))
    deps = [
        ("T-01", "T-02", "MVP scope precedes backend"),
        ("T-01", "T-03", "MVP scope precedes frontend"),
        ("T-01", "T-04", "MVP scope precedes agent workflow"),
        ("T-02", "T-05", "Backend before integration testing"),
        ("T-03", "T-05", "Frontend before integration testing"),
        ("T-04", "T-05", "Workflow before integration testing"),
        ("T-05", "T-06", "Testing before demo"),
    ]
    for s, t, reason in deps:
        db.add(TaskDependency(project_id=project.id, source_task=s, target_task=t, reason=reason))
    db.flush()


def _seed_risks_portfolio_lessons(db: Session, project: Project) -> None:
    if not db.query(PortfolioProject).filter_by(project_id=project.id).first():
        db.add(PortfolioProject(project_id=project.id, health=68.0, risk_level="medium",
                                progress=0.15, delivery_confidence=0.62, rescue_mode="inactive",
                                next_milestone="Integration testing"))
    if not db.query(LessonsLearned).first():
        db.add(LessonsLearned(project_id=project.id, category="went_wrong",
                              title="Testing left too late",
                              detail="A previous hackathon started testing 1 day before the demo.",
                              recommendation="Reserve a minimum 3-day testing window.",
                              tags=["testing", "schedule"]))
        db.add(LessonsLearned(project_id=project.id, category="went_well",
                              title="Template-based WBS saved time",
                              detail="Reusing an AI-application template avoided planning from scratch.",
                              recommendation="Maintain curated WBS templates per project type.",
                              tags=["wbs", "templates"]))
    # knowledge graph sample
    if not db.query(KnowledgeNode).filter_by(project_id=project.id).first():
        nodes = [("proj", "project", project.name), ("risk_test", "risk", "Testing window risk"),
                 ("task_test", "task", "Integration testing"), ("deliv_demo", "deliverable", "Demo")]
        for key, typ, label in nodes:
            db.add(KnowledgeNode(project_id=project.id, node_key=key, node_type=typ, label=label))
        edges = [("risk_test", "task_test", "affects"), ("task_test", "deliv_demo", "supports"),
                 ("proj", "risk_test", "has_risk")]
        for s, t, rel in edges:
            db.add(KnowledgeEdge(project_id=project.id, source_key=s, target_key=t, relation=rel))
    # a sample audit record
    if not db.query(AuditLog).first():
        db.add(AuditLog(audit_id="aud_seed0000000001", project_id=project.id,
                        agent="risk-engine", action="risk.evaluate",
                        input_summary="Seed evaluation",
                        output_summary="Testing window risk flagged",
                        rules_triggered=["RISK_TESTING_WINDOW_MINIMUM"], confidence=1.0,
                        approval_status="suggested"))
    db.flush()


_EXTRA_PROJECTS = [
    {
        "name": "Customer Portal Revamp",
        "objective": "Modernise the self-service customer portal with a new UX.",
        "type": "web_application", "methodology": "hybrid", "priority": "medium",
        "deadline_days": 45, "completeness": 0.9,
        "portfolio": {"health": 86.0, "risk_level": "low", "progress": 0.4,
                      "confidence": 0.82, "rescue": "inactive", "milestone": "Beta release"},
        "members": [
            ("Maya Wong", "Frontend Engineer", 40, {"react": 5, "typescript": 4, "ux": 4}),
            ("Omar Farah", "Backend Engineer", 40, {"python": 5, "sql": 4, "fastapi": 4}),
            ("Nina Patel", "QA Engineer", 40, {"qa": 5, "writing": 3}),
        ],
        "tasks": [
            ("P2-01", "Discovery & wireframes", 2, 3, 5, ["analysis", "ux"]),
            ("P2-02", "API endpoints", 3, 5, 8, ["python", "fastapi"]),
            ("P2-03", "Build screens", 4, 6, 10, ["react", "typescript"]),
            ("P2-04", "QA & UAT", 2, 3, 5, ["qa"]),
            ("P2-05", "Release", 1, 2, 3, ["devops"]),
        ],
        "deps": [("P2-01", "P2-02"), ("P2-01", "P2-03"), ("P2-02", "P2-04"),
                 ("P2-03", "P2-04"), ("P2-04", "P2-05")],
    },
    {
        "name": "Q3 Data Migration",
        "objective": "Migrate legacy records to the new data platform before quarter end.",
        "type": "migration", "methodology": "waterfall", "priority": "high",
        "deadline_days": 7, "completeness": 0.5,
        "portfolio": {"health": 41.0, "risk_level": "high", "progress": 0.2,
                      "confidence": 0.38, "rescue": "active", "milestone": "Cutover"},
        "members": [
            ("Raj Kumar", "Data Engineer", 40, {"data": 5, "python": 4}),
        ],
        "tasks": [
            ("P3-01", "Schema mapping", 2, 4, 7, ["data"]),
            ("P3-02", "Build migration pipeline", 3, 6, 12, ["data", "python"]),
            ("P3-03", "Validation & reconciliation", 2, 4, 8, ["data", "qa"]),
            ("P3-04", "Cutover", 1, 2, 5, ["devops", "security"]),
        ],
        "deps": [("P3-01", "P3-02"), ("P3-02", "P3-03"), ("P3-03", "P3-04")],
    },
]


def _seed_extra_projects(db: Session) -> None:
    owner = db.query(User).filter_by(email="pm@sentinel.dev").first()
    start = date(2026, 8, 1)
    skill_cache: dict[str, Skill] = {}
    for spec in _EXTRA_PROJECTS:
        if db.query(Project).filter_by(name=spec["name"]).first():
            continue
        project = Project(
            name=spec["name"], objective=spec["objective"], description=spec["objective"],
            project_type=spec["type"], methodology=spec["methodology"], priority=spec["priority"],
            status="in_progress", start_date=start,
            deadline=start + timedelta(days=spec["deadline_days"]),
            owner_id=owner.id if owner else None, intake_completeness=spec["completeness"],
            profile={"project_type": spec["type"], "team_size": len(spec["members"])},
        )
        db.add(project)
        db.flush()
        for name, role, cap, skills in spec["members"]:
            member = Member(project_id=project.id, name=name, role=role, capacity_hours=cap,
                            email=name.lower().replace(" ", ".") + "@sentinel.dev")
            db.add(member)
            db.flush()
            for skill_name, level in skills.items():
                skill = skill_cache.get(skill_name)
                if not skill:
                    skill = db.query(Skill).filter_by(name=skill_name).first() or Skill(name=skill_name)
                    db.add(skill)
                    db.flush()
                    skill_cache[skill_name] = skill
                db.add(MemberSkill(member_id=member.id, skill_id=skill.id, proficiency=level))
        for ext, title, o, m, p, skills in spec["tasks"]:
            db.add(Task(project_id=project.id, ext_id=ext, title=title, optimistic=o,
                        most_likely=m, pessimistic=p, required_skills=skills))
        for s, t in spec["deps"]:
            db.add(TaskDependency(project_id=project.id, source_task=s, target_task=t,
                                  reason="Sequential dependency"))
        pf = spec["portfolio"]
        db.add(PortfolioProject(project_id=project.id, health=pf["health"],
                                risk_level=pf["risk_level"], progress=pf["progress"],
                                delivery_confidence=pf["confidence"], rescue_mode=pf["rescue"],
                                next_milestone=pf["milestone"]))
    db.flush()


def run() -> None:
    init_db()
    db = SessionLocal()
    try:
        seed(db)
        print("Seed complete. Sample brief length:", len(HACKATHON_BRIEF), "chars.")
    finally:
        db.close()
