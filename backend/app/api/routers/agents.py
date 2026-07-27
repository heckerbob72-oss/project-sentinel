"""Agent + workflow orchestration routes."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from ...agents import AGENT_REGISTRY
from ...core.audit import record_audit
from ...core.exceptions import SentinelError
from ...core.response import success
from ...models.audit import AgentRun
from ...workflows import run_planning_workflow
from ..deps import get_current_user, get_db

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("")
def list_agents(user=Depends(get_current_user)):
    return success([
        {"name": a.name, "purpose": a.purpose} for a in AGENT_REGISTRY.values()
    ])


@router.post("/{agent_name}/run")
def run_agent(
    agent_name: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    agent = AGENT_REGISTRY.get(agent_name)
    if not agent:
        raise SentinelError("agent_not_found", f"Unknown agent '{agent_name}'.", status_code=404)
    result = agent.run(payload)
    db.add(AgentRun(agent=agent.name, inputs={"keys": list(payload.keys())},
                    outputs={"summary": result.explanation.summary},
                    confidence=result.explanation.confidence))
    audit_id = record_audit(db, action=f"agent.{agent.name}", agent=agent.name,
                            user_id=user.id, explanation=result.explanation.to_dict())
    return success(result.data, result.explanation.to_dict(), audit_id=audit_id,
                   next_actions=result.next_actions)


@router.post("/workflow/plan")
def run_workflow(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Run the full LangGraph planning pipeline end-to-end."""
    final = run_planning_workflow(payload)
    trace = final.get("trace", [])
    audit_id = record_audit(
        db, action="workflow.plan", agent="langgraph-orchestrator", user_id=user.id,
        input_summary=str(list(payload.keys())),
        output_summary=f"{len(trace)} agents executed",
    )
    return success(
        {
            "trace": trace,
            "wbs_items": final.get("wbs_items", []),
            "schedule": final.get("schedule", {}),
            "risks": final.get("risks", []),
            "health": final.get("health", {}),
            "success": final.get("success", {}),
        },
        audit_id=audit_id,
    )
