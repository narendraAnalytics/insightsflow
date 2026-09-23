"""Central exception handling. Every error the API returns comes back as a
consistent JSON shape: {"error": {"code", "message", "request_id"}}.

Never leak raw exception messages/tracebacks to the client in production —
log the detail server-side, return a generic message client-side.
"""

import structlog
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.config import get_settings

logger = structlog.get_logger("errors")


def _add_cors_headers(request: Request, response: JSONResponse) -> None:
    """Handlers for the bare `Exception` class run in Starlette's
    ServerErrorMiddleware, which sits OUTSIDE app.add_middleware(CORSMiddleware)
    — so without this, any unexpected server error on a cross-origin request
    (any fetch() from the Next.js frontend) never gets Access-Control-Allow-
    Origin, and the browser reports a generic "Failed to fetch" instead of
    surfacing the real 500 body. AppError/HTTPException handlers don't need
    this — they run inside the normal middleware stack."""
    origin = request.headers.get("origin")
    settings = get_settings()
    if origin and origin in settings.cors_origin_list:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"


class AppError(Exception):
    """Base class for application (expected, handled) errors. Raise a
    subclass of this from services/routes instead of raw HTTPException
    when you want a stable machine-readable `code`."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "app_error"

    def __init__(self, message: str, *, code: str | None = None):
        self.message = message
        if code:
            self.code = code
        super().__init__(message)


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


def _error_body(code: str, message: str, request_id: str | None) -> dict:
    return {"error": {"code": code, "message": message, "request_id": request_id}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        request_id = request.headers.get("X-Request-ID")
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.code, exc.message, request_id),
        )

    @app.exception_handler(HTTPException)
    async def handle_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
        request_id = request.headers.get("X-Request-ID")
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body("http_error", str(exc.detail), request_id),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        request_id = request.headers.get("X-Request-ID")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_body("validation_error", "Invalid request", request_id)
            | {"details": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        request_id = request.headers.get("X-Request-ID")
        logger.exception("unhandled_exception", path=request.url.path)
        response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body("internal_error", "Something went wrong", request_id),
        )
        _add_cors_headers(request, response)
        return response
