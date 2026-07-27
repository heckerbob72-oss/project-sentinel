"""Domain exceptions and FastAPI handlers producing the error envelope."""
from __future__ import annotations

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .response import error


class SentinelError(Exception):
    def __init__(self, error_code: str, message: str, details: dict | None = None,
                 suggested_action: str = "", status_code: int = 400):
        self.error_code = error_code
        self.message = message
        self.details = details or {}
        self.suggested_action = suggested_action
        self.status_code = status_code
        super().__init__(message)


def register_exception_handlers(app) -> None:
    @app.exception_handler(SentinelError)
    async def _sentinel(_: Request, exc: SentinelError):
        return JSONResponse(
            status_code=exc.status_code,
            content=error(exc.error_code, exc.message, exc.details, exc.suggested_action),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=error(
                error_code=f"http_{exc.status_code}",
                message=str(exc.detail),
                suggested_action="Check the request and authentication.",
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error(
                error_code="validation_error",
                message="Request validation failed.",
                details={"errors": exc.errors()},
                suggested_action="Correct the highlighted fields and retry.",
            ),
        )
