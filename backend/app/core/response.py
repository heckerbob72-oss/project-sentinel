"""Standard API response envelope builders.

Every important Sentinel endpoint returns the same explainable shape:
  { status, data, explanation, audit_id, next_actions }
Errors return:
  { status, error_code, message, details, suggested_action }
"""
from __future__ import annotations

from typing import Any


def success(
    data: Any,
    explanation: dict | None = None,
    audit_id: str | None = None,
    next_actions: list[dict] | None = None,
) -> dict:
    return {
        "status": "success",
        "data": data,
        "explanation": explanation
        or {
            "summary": "",
            "reasoning": [],
            "evidence": [],
            "rules_triggered": [],
            "calculations": [],
            "confidence": 1.0,
        },
        "audit_id": audit_id,
        "next_actions": next_actions or [],
    }


def error(
    error_code: str,
    message: str,
    details: dict | None = None,
    suggested_action: str | None = None,
) -> dict:
    return {
        "status": "error",
        "error_code": error_code,
        "message": message,
        "details": details or {},
        "suggested_action": suggested_action or "",
    }


def next_action(action: str, reason: str, priority: str, module: str) -> dict:
    return {"action": action, "reason": reason, "priority": priority, "module": module}
