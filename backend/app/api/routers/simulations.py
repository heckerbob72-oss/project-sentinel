"""Digital Twin simulation routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.audit import record_audit
from ...core.exceptions import SentinelError
from ...core.response import success
from ...engines import SimulationEngine
from ...models.project import Project
from ...models.simulation import Simulation, SimulationResult
from ...schemas.planning import SimulationRequest
from ..deps import get_current_user, get_db
from .insight import derive_project_metrics
from .planning import _deps_for, _tasks_for

router = APIRouter(tags=["simulations"])


@router.post("/projects/{project_id}/simulations")
def run_simulation(
    project_id: int,
    body: SimulationRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project or project.is_deleted:
        raise SentinelError("not_found", f"Project {project_id} not found.", status_code=404)
    deadline = None
    if project and project.start_date and project.deadline:
        deadline = (project.deadline - project.start_date).days

    state = {
        "tasks": _tasks_for(db, project_id),
        "dependencies": _deps_for(db, project_id),
        "deadline": deadline or 30,
        "health_metrics": derive_project_metrics(db, project_id),
    }
    try:
        res = SimulationEngine().simulate(state, body.scenario, body.params)
    except (KeyError, TypeError, ValueError) as exc:
        raise SentinelError(
            "invalid_simulation",
            str(exc),
            suggested_action="Correct the scenario parameters and retry.",
            status_code=422,
        ) from exc

    sim = Simulation(project_id=project_id, scenario=body.scenario, params=body.params,
                     created_by=user.id)
    db.add(sim)
    db.flush()
    db.add(SimulationResult(
        simulation_id=sim.id, before_state=res.before, after_state=res.after,
        deltas=res.deltas, new_risks=res.new_risks, explanation=res.explanation.to_dict(),
    ))
    audit_id = record_audit(db, action="simulation.run", agent="simulation-engine",
                            project_id=project_id, user_id=user.id,
                            input_summary=body.scenario, explanation=res.explanation.to_dict())
    db.commit()
    return success(res.to_dict(), res.explanation.to_dict(), audit_id=audit_id)
