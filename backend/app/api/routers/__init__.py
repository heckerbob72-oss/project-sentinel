"""Aggregate all API routers under one router."""
from fastapi import APIRouter

from . import (
    agents,
    auth,
    documents,
    extra,
    import_,
    insight,
    misc,
    planning,
    projects,
    simulations,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(planning.router)
api_router.include_router(insight.router)
api_router.include_router(extra.router)
api_router.include_router(simulations.router)
api_router.include_router(agents.router)
api_router.include_router(documents.router)
api_router.include_router(import_.router)
for r in misc.ALL_ROUTERS:
    api_router.include_router(r)

__all__ = ["api_router"]
