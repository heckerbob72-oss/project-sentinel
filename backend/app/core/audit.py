"""Audit logging helper — records every important agent/engine decision."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session


def new_audit_id() -> str:
    return f"aud_{uuid.uuid4().hex[:16]}"


def record_audit(
    db: Session,
    *,
    action: str,
    agent: str,
    user_id: int | None = None,
    project_id: int | None = None,
    input_summary: str = "",
    output_summary: str = "",
    explanation: dict | None = None,
    confidence: float | None = None,
    approval_status: str = "suggested",
) -> str:
    """Persist an audit record and return its audit_id.

    Import kept local to avoid circular imports with models.
    """
    from ..models.audit import AuditLog

    audit_id = new_audit_id()
    exp = explanation or {}
    entry = AuditLog(
        audit_id=audit_id,
        action=action,
        agent=agent,
        user_id=user_id,
        project_id=project_id,
        input_summary=input_summary[:2000],
        output_summary=output_summary[:2000],
        evidence=exp.get("evidence", []),
        rules_triggered=exp.get("rules_triggered", []),
        calculations=exp.get("calculations", []),
        confidence=confidence if confidence is not None else exp.get("confidence", 1.0),
        approval_status=approval_status,
    )
    db.add(entry)
    db.commit()
    return audit_id
