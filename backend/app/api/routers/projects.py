"""Project CRUD routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.audit import record_audit
from ...core.exceptions import SentinelError
from ...core.rbac import Permission, require_permission
from ...core.response import success
from ...models.project import Project
from ...models.user import User
from ...schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from ..deps import get_current_user, get_db

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    projects = db.query(Project).filter(Project.is_deleted.is_(False)).all()
    return success([ProjectOut.model_validate(p).model_dump(mode="json") for p in projects])


@router.post("")
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.PROJECT_CREATE)),
):
    project = Project(**body.model_dump(), owner_id=user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    audit_id = record_audit(
        db, action="project.create", agent="user", user_id=user.id,
        project_id=project.id, input_summary=body.name,
        output_summary=f"Created project {project.id}", approval_status="approved",
    )
    return success(ProjectOut.model_validate(project).model_dump(mode="json"), audit_id=audit_id)


@router.get("/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = _get(db, project_id)
    return success(ProjectOut.model_validate(project).model_dump(mode="json"))


@router.patch("/{project_id}")
def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission(Permission.PROJECT_EDIT)),
):
    project = _get(db, project_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(project, k, v)
    db.commit()
    db.refresh(project)
    record_audit(db, action="project.update", agent="user", user_id=user.id,
                 project_id=project.id, approval_status="approved")
    return success(ProjectOut.model_validate(project).model_dump(mode="json"))


def _get(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted.is_(False)).first()
    if not project:
        raise SentinelError("not_found", f"Project {project_id} not found.", status_code=404)
    return project
