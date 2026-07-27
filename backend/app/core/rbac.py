"""Role-based access control: roles, permissions, and FastAPI guards."""
from __future__ import annotations

from enum import Enum

from fastapi import Depends, HTTPException, status


class Role(str, Enum):
    ADMIN = "Admin"
    PROJECT_MANAGER = "ProjectManager"
    TEAM_LEAD = "TeamLead"
    CONTRIBUTOR = "Contributor"
    VIEWER = "Viewer"


class Permission(str, Enum):
    PROJECT_CREATE = "project:create"
    PROJECT_EDIT = "project:edit"
    DOCUMENT_UPLOAD = "document:upload"
    TASK_EDIT = "task:edit"
    RISK_APPROVE = "risk:approve"
    REPORT_GENERATE = "report:generate"
    ADMIN_SETTINGS = "admin:settings"
    AUDIT_VIEW = "audit:view"


# Role -> permission matrix. Higher roles inherit lower-role capabilities.
ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.ADMIN: set(Permission),
    Role.PROJECT_MANAGER: {
        Permission.PROJECT_CREATE,
        Permission.PROJECT_EDIT,
        Permission.DOCUMENT_UPLOAD,
        Permission.TASK_EDIT,
        Permission.RISK_APPROVE,
        Permission.REPORT_GENERATE,
        Permission.AUDIT_VIEW,
    },
    Role.TEAM_LEAD: {
        # Team leads may self-register and need to create their own project to
        # import/plan against — without this, a brand-new user could never
        # get past the login screen to a usable project.
        Permission.PROJECT_CREATE,
        Permission.PROJECT_EDIT,
        Permission.DOCUMENT_UPLOAD,
        Permission.TASK_EDIT,
        Permission.REPORT_GENERATE,
    },
    Role.CONTRIBUTOR: {
        Permission.DOCUMENT_UPLOAD,
        Permission.TASK_EDIT,
    },
    Role.VIEWER: set(),
}


def has_permission(role: str, permission: Permission) -> bool:
    try:
        r = Role(role)
    except ValueError:
        return False
    return permission in ROLE_PERMISSIONS.get(r, set())


def require_permission(permission: Permission):
    """Dependency factory that enforces a permission on the current user."""
    # Imported here to avoid a circular import at module load.
    from ..api.deps import get_current_user

    def _guard(user=Depends(get_current_user)):
        if not has_permission(user.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' lacks permission '{permission.value}'.",
            )
        return user

    return _guard
