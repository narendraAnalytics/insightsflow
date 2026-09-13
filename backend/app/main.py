"""InsightFlow FastAPI application factory."""

from contextlib import asynccontextmanager

import sentry_sdk
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.core.platform import apply_windows_asyncio_fix

# Helps pytest-asyncio and any plain asyncio.run() caller on Windows dev
# machines (see app/core/platform.py for why this does NOT fix uvicorn
# itself — local dev runs through app/dev_server.py instead). No-op in
# production (Linux).
apply_windows_asyncio_fix()

logger = structlog.get_logger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("app_startup", app_env=settings.app_env)
    yield
    logger.info("app_shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings)

    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.app_env,
            traces_sample_rate=0.1 if settings.is_production else 1.0,
        )

    app = FastAPI(
        title="InsightFlow API",
        version="0.1.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestContextMiddleware)

    register_exception_handlers(app)

    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()
