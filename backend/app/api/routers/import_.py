"""Project-import endpoints: turn a GitHub repo, pasted text, or accumulated
intake answers into real, persisted project data (profile facts, then a full
WBS/task/dependency/team plan).

These endpoints are the missing link the rest of the app already assumed
existed: `IntakeAgent`/`GapDetectionAgent` could merge answers and surface
questions, and `WorkBreakdownAgent`/`DependencyAgent` could compute a plan,
but nothing previously *persisted* that plan as real Task/TaskDependency/
Member rows. This module closes that gap.
"""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...agents import (
    DependencyAgent,
    DocumentAnalysisAgent,
    GitHubImportAgent,
    IntakeAgent,
    WorkBreakdownAgent,
)
from ...core.audit import record_audit
from ...core.rbac import Permission, require_permission
from ...core.response import success
from ...integrations.github import fetch_github_repo
from ...models.project import Project
from ...models.team import Member, MemberSkill, Skill
from ...models.work import Task, TaskDependency, WBSItem
from ...schemas.planning import GeneratePlanRequest, GitHubImportRequest, TextImportRequest
from ..deps import get_db
from .extra import _project_or_404

router = APIRouter(tags=["import"])

# Facts extracted by upstream agents don't always use the exact INTAKE_FIELDS
# name (e.g. DocumentAnalysisAgent extracts "objective"); normalize aliases
# here so gap-detection/completeness scoring actually picks them up.
_FIELD_ALIASES = {"objective": "project_objective"}
_BULLET_RE = re.compile(r"^\s*(?:[-*\u2022]|\d+[.)])\s+(.{3,200})$", re.MULTILINE)


def _normalize_facts(facts: dict) -> dict:
    out = {}
    for key, value in facts.items():
        if key.startswith("_"):
            continue  # drop internal keys like "_digest"
        out[_FIELD_ALIASES.get(key, key)] = value
    return out


def _extract_bullets(text: str) -> list[str]:
    """Heuristic: pull bullet/numbered list lines out of pasted text as candidate deliverables."""
    return [b.strip() for b in _BULLET_RE.findall(text)][:20]


def _merge_and_respond(db: Session, project: Project, facts: dict, source_result, *, action: str):
    normalized = _normalize_facts(facts)
    intake = IntakeAgent().run({"profile": project.profile or {}, "answers": normalized})
    project.profile = intake.data["profile"]
    project.intake_completeness = intake.data["completeness"]
    audit_id = record_audit(
        db, action=action, agent=source_result.agent, project_id=project.id,
        explanation=source_result.explanation.to_dict(),
    )
    db.commit()
    data = {
        **source_result.data,
        "profile": project.profile,
        "completeness": project.intake_completeness,
    }
    combined_explanation = source_result.explanation.to_dict()
    combined_explanation["merge"] = intake.explanation.to_dict()
    return success(data, combined_explanation, audit_id=audit_id, next_actions=source_result.next_actions)


@router.post("/projects/{project_id}/import/github")
def import_github(project_id: int, body: GitHubImportRequest, db: Session = Depends(get_db),
                  user=Depends(require_permission(Permission.DOCUMENT_UPLOAD))):
    project = _project_or_404(db, project_id)
    repo = fetch_github_repo(body.repo_url)
    r = GitHubImportAgent().run({"repo": repo, "repo_url": body.repo_url})
    return _merge_and_respond(db, project, r.data["facts"], r, action="import.github")


@router.post("/projects/{project_id}/import/text")
def import_text(project_id: int, body: TextImportRequest, db: Session = Depends(get_db),
                user=Depends(require_permission(Permission.DOCUMENT_UPLOAD))):
    project = _project_or_404(db, project_id)
    r = DocumentAnalysisAgent().run({"text": body.text, "document": "pasted-text"})
    facts = dict(r.data["facts"])
    if "deliverables" not in facts:
        bullets = _extract_bullets(body.text)
        if bullets:
            facts["deliverables"] = bullets
            r.explanation.add_evidence("document:pasted-text", "Bulleted lines treated as deliverables", value=bullets)
    return _merge_and_respond(db, project, facts, r, action="import.text")


def _clear_generated_plan(db: Session, project_id: int) -> None:
    db.query(WBSItem).filter(WBSItem.project_id == project_id).update({"is_deleted": True})
    db.query(Task).filter(Task.project_id == project_id).update({"is_deleted": True})
    db.query(TaskDependency).filter(TaskDependency.project_id == project_id).delete()


def _persist_wbs_and_tasks(db: Session, project_id: int, wbs_items: list[dict]) -> list[dict]:
    for item in wbs_items:
        db.add(WBSItem(
            project_id=project_id, wbs_code=item["wbs_code"], ext_id=item["ext_id"],
            phase=item["phase"], title=item["title"], deliverable=item["deliverable"],
            estimated_effort=item["most_likely"], required_skills=item["required_skills"],
            template_source=item["template_source"], explanation={"note": item["explanation"]},
        ))
        db.add(Task(
            project_id=project_id, ext_id=item["ext_id"], title=item["title"],
            optimistic=item["optimistic"], most_likely=item["most_likely"],
            pessimistic=item["pessimistic"], required_skills=item["required_skills"],
        ))
    db.flush()
    return [{"id": i["ext_id"], "label": i["title"], "optimistic": i["optimistic"],
             "most_likely": i["most_likely"], "pessimistic": i["pessimistic"],
             "required_skills": i["required_skills"]} for i in wbs_items]


def _phase_chain_dependencies(wbs_items: list[dict]) -> list[dict]:
    """Deterministic sequencing: every task in a phase depends on the last task
    of the previous phase. Mirrors the hand-built seed plan's fan-out pattern
    without inventing task-level relationships the template didn't imply."""
    phase_order: list[str] = []
    phase_tasks: dict[str, list[str]] = {}
    for item in wbs_items:
        phase = item["phase"]
        if phase not in phase_tasks:
            phase_tasks[phase] = []
            phase_order.append(phase)
        phase_tasks[phase].append(item["ext_id"])

    deps: list[dict] = []
    for i in range(1, len(phase_order)):
        prev_phase, cur_phase = phase_order[i - 1], phase_order[i]
        prev_last = phase_tasks[prev_phase][-1]
        for ext_id in phase_tasks[cur_phase]:
            deps.append({
                "source": prev_last, "target": ext_id, "type": "finish_to_start",
                "reason": f"'{prev_phase}' phase precedes '{cur_phase}' phase",
            })
    return deps


def _persist_dependencies(db: Session, project_id: int, deps: list[dict]) -> None:
    for d in deps:
        db.add(TaskDependency(project_id=project_id, source_task=d["source"], target_task=d["target"],
                              dependency_type=d["type"], reason=d["reason"]))
    db.flush()


def _persist_members(db: Session, project_id: int, team_members: list) -> int:
    existing = {m.name for m in db.query(Member).filter(Member.project_id == project_id,
                                                         Member.is_deleted.is_(False)).all()}
    skill_cache: dict[str, Skill] = {}
    created = 0
    for raw in team_members:
        # The intake wizard's suggested-question flow collects team members as
        # plain name strings; imports (GitHub/document) may supply richer dicts.
        tm = raw if isinstance(raw, dict) else {"name": raw}
        name = str(tm.get("name") or "").strip()
        if not name or name in existing:
            continue
        member = Member(project_id=project_id, name=name, role=tm.get("role", "Contributor"),
                        email=tm.get("email", ""), capacity_hours=tm.get("capacity_hours", 40.0))
        db.add(member)
        db.flush()
        for skill_name, level in (tm.get("skills") or {}).items():
            skill = skill_cache.get(skill_name)
            if not skill:
                skill = db.query(Skill).filter_by(name=skill_name).first() or Skill(name=skill_name)
                db.add(skill)
                db.flush()
                skill_cache[skill_name] = skill
            db.add(MemberSkill(member_id=member.id, skill_id=skill.id, proficiency=level))
        existing.add(name)
        created += 1
    db.flush()
    return created


@router.post("/projects/{project_id}/generate-plan")
def generate_plan(project_id: int, body: GeneratePlanRequest, db: Session = Depends(get_db),
                  user=Depends(require_permission(Permission.TASK_EDIT))):
    project = _project_or_404(db, project_id)

    if body.answers:
        intake = IntakeAgent().run({"profile": project.profile or {}, "answers": _normalize_facts(body.answers)})
        project.profile = intake.data["profile"]
        project.intake_completeness = intake.data["completeness"]

    profile = project.profile or {}
    wbs_result = WorkBreakdownAgent().run({
        "project_type": profile.get("project_type", "ai_application"),
        "deliverables": profile.get("deliverables", []),
    })
    wbs_items = wbs_result.data["wbs_items"]

    _clear_generated_plan(db, project_id)
    tasks = _persist_wbs_and_tasks(db, project_id, wbs_items)
    deps = _phase_chain_dependencies(wbs_items)
    _persist_dependencies(db, project_id, deps)
    members_created = _persist_members(db, project_id, profile.get("team_members", []))

    dep_result = DependencyAgent().run({"tasks": tasks, "dependencies": deps})

    combined_explanation = wbs_result.explanation.to_dict()
    combined_explanation["dependency_check"] = dep_result.explanation.to_dict()
    audit_id = record_audit(
        db, action="plan.generate", agent=wbs_result.agent, project_id=project_id,
        explanation=combined_explanation,
        output_summary=f"{len(tasks)} tasks, {len(deps)} dependencies, {members_created} members added",
    )
    db.commit()

    data = {
        "task_count": len(tasks), "dependency_count": len(deps),
        "members_added": members_created, "has_cycle": dep_result.data.get("cycle", {}).get("has_cycle", False),
        "template_used": wbs_items[0]["template_source"] if wbs_items else None,
    }
    na = [
        {"action": "Review the generated timeline", "reason": "Plan was just (re)generated",
         "priority": "high", "module": "timeline"},
        {"action": "Confirm team allocations", "reason": "Members were merged from the intake profile",
         "priority": "medium", "module": "resources"},
    ]
    return success(data, combined_explanation, audit_id=audit_id, next_actions=na)
