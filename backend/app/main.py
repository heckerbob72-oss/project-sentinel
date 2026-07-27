"""Project Sentinel FastAPI application entrypoint."""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.routers import api_router
from .config import settings
from .core.exceptions import register_exception_handlers
from .core.response import error

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="The Agentic AI Project Co-ordinator — explainable, deterministic-first.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- lightweight in-memory rate limiter (per client IP) ---
_hits: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    ip = request.client.host if request.client else "anon"
    now = time.time()
    window = _hits[ip]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= settings.rate_limit_per_minute:
        return JSONResponse(
            status_code=429,
            content=error("rate_limited", "Too many requests.",
                          suggested_action="Slow down and retry shortly."),
        )
    window.append(now)
    return await call_next(request)


register_exception_handlers(app)
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": settings.app_name, "environment": settings.environment}


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "api": settings.api_v1_prefix,
        "philosophy": "Deterministic where computable; LLM only for language; every output explained.",
    }
