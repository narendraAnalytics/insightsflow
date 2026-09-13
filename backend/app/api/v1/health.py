"""Liveness and readiness probes.

/healthz — liveness: process is up. Never touches the DB/Redis; used by the
           platform (Render/Coolify/Docker) to decide whether to restart
           the container. Must stay fast and dependency-free.
/readyz  — readiness: process is up AND its dependencies (DB, Redis) are
           reachable. Used to decide whether to route traffic to this
           instance. Safe to be a bit slower / to fail during a DB blip.
"""

import asyncio
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.session import get_db

logger = structlog.get_logger("health")

router = APIRouter(tags=["health"])

# Bounded timeouts so a real outage reports "degraded" quickly instead of
# hanging — Render/Coolify/Docker all restart on a slow/failed healthcheck,
# so an unbounded hang here can cause a restart loop instead of a clean
# reading. DB gets a longer allowance than Redis because Neon's serverless
# compute auto-suspends when idle and a cold start can take several
# seconds (observed ~5s locally); 3s was measured to falsely report
# "error" on a cold Neon endpoint that was actually fine. Redis (self-
# hosted or Upstash) doesn't have this cold-start behavior.
_DB_CHECK_TIMEOUT_SECONDS = 8.0
_REDIS_CHECK_TIMEOUT_SECONDS = 3.0


@router.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    checks: dict[str, str] = {}
    healthy = True

    try:
        async with asyncio.timeout(_DB_CHECK_TIMEOUT_SECONDS):
            await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        logger.exception("readyz_database_check_failed")
        checks["database"] = "error"
        healthy = False

    try:
        redis = Redis.from_url(settings.redis_url, socket_connect_timeout=2)
        try:
            async with asyncio.timeout(_REDIS_CHECK_TIMEOUT_SECONDS):
                await redis.ping()
            checks["redis"] = "ok"
        finally:
            await redis.aclose()
    except Exception:
        logger.exception("readyz_redis_check_failed")
        checks["redis"] = "error"
        healthy = False

    return {"status": "ok" if healthy else "degraded", "checks": checks}
