"""Async SQLAlchemy engine/session wired for Neon's pooled (PgBouncer)
endpoint.

Neon's pooled endpoint runs PgBouncer in transaction mode, which is not
compatible with psycopg's server-side prepared statements (a prepared
statement is bound to one backend connection, but PgBouncer can hand a
different backend to the next statement in the same client session).
`prepare_threshold=None` disables psycopg's automatic server-side prepare,
which is the documented-safe setting for any transaction-mode pooler.
DATABASE_URL_DIRECT (unpooled) does not need this and is used only by
Alembic (see migrations/env.py).
"""

from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings, get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    settings: Settings = get_settings()
    return create_async_engine(
        settings.database_url,
        pool_pre_ping=True,
        connect_args={
            "prepare_threshold": None,
            # Fail fast on a real outage instead of hanging on the OS-level
            # TCP timeout (which can be tens of seconds to minutes) — this
            # bit us in /readyz against an unreachable host during testing.
            # Kept above /readyz's own asyncio.timeout (see health.py) so
            # that outer timeout is what actually fires on a Neon cold
            # start (observed ~5s to wake a suspended compute), not this
            # one cutting off a connection that would have succeeded.
            "connect_timeout": 10,
        },
    )


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(bind=get_engine(), expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields a request-scoped AsyncSession, always
    closed at the end of the request even on error."""
    session_factory = get_sessionmaker()
    async with session_factory() as session:
        yield session
