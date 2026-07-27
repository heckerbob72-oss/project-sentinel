"""Celery application for background jobs (report generation, re-scoring, etc.).

Optional at runtime — enabled via the `workers` compose profile. Tasks are kept
thin: they invoke the same deterministic engines/agents used synchronously so
results stay explainable.
"""
from __future__ import annotations

from celery import Celery

from ..config import settings

celery_app = Celery(
    "sentinel",
    broker=settings.redis_url,
    backend=settings.redis_url,
)
celery_app.conf.update(task_track_started=True, task_time_limit=300)


@celery_app.task(name="sentinel.recompute_health")
def recompute_health(project_id: int) -> dict:
    """Recompute a project's health asynchronously."""
    from ..database import SessionLocal
    from ..api.routers.insight import derive_project_metrics
    from ..agents import HealthAgent

    db = SessionLocal()
    try:
        metrics = derive_project_metrics(db, project_id)
        return HealthAgent().run({"metrics": metrics}).data
    finally:
        db.close()
