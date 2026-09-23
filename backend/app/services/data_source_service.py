"""Business logic for data sources (spreadsheet + tab) — no FastAPI imports.
Every read/write is scoped to the requesting user; a source id from another
user behaves exactly like one that doesn't exist."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, NotFoundError
from app.db.models.connection import Connection
from app.db.models.data_source import DataSource
from app.integrations.google import sheets as google_sheets
from app.services import connection_service

logger = structlog.get_logger(__name__)

# How long cached headers/row counts are trusted before the next page load
# re-reads the live sheet. Keeps Google API usage flat however often the
# Integrations page is opened.
STATS_TTL = timedelta(minutes=5)
MAX_SOURCES_PER_USER = 25
_REFRESH_CONCURRENCY = 5


class TooManySources(AppError):
    status_code = 409
    code = "too_many_sources"


async def list_sources(session: AsyncSession, clerk_user_id: str) -> list[DataSource]:
    user = await connection_service.get_or_create_user(session, clerk_user_id)
    result = await session.execute(
        select(DataSource).where(DataSource.user_id == user.id).order_by(DataSource.created_at)
    )
    return list(result.scalars())


async def get_source(session: AsyncSession, clerk_user_id: str, source_id: uuid.UUID) -> DataSource:
    user = await connection_service.get_or_create_user(session, clerk_user_id)
    result = await session.execute(
        select(DataSource).where(DataSource.id == source_id, DataSource.user_id == user.id)
    )
    source = result.scalar_one_or_none()
    if source is None:
        raise NotFoundError("Data source not found")
    return source


async def _connection_and_token(
    session: AsyncSession, clerk_user_id: str
) -> tuple[Connection, str]:
    connection = await connection_service.get_connection(session, clerk_user_id)
    token = await connection_service.get_valid_access_token(session, connection)
    return connection, token


def _apply_metadata(source: DataSource, meta: google_sheets.SheetMetadata) -> None:
    source.name = meta.name
    source.tab_title = meta.tab_title
    source.tab_id = meta.tab_id
    source.headers = meta.headers
    source.row_count = meta.row_count
    source.synced_at = datetime.now(UTC)


async def list_tabs(
    session: AsyncSession, clerk_user_id: str, spreadsheet_id: str
) -> google_sheets.SpreadsheetInfo:
    """Tabs of a spreadsheet the user already granted — lets them add another
    tab without going through the Picker again."""
    _, token = await _connection_and_token(session, clerk_user_id)
    return await asyncio.to_thread(google_sheets.get_spreadsheet_info, token, spreadsheet_id)


async def add_source(
    session: AsyncSession,
    clerk_user_id: str,
    spreadsheet_id: str,
    tab_title: str | None,
) -> DataSource:
    """Adds a spreadsheet tab (first tab when `tab_title` is None). Idempotent:
    adding the same tab twice returns the existing source, refreshed."""
    connection, token = await _connection_and_token(session, clerk_user_id)
    meta = await asyncio.to_thread(
        google_sheets.fetch_sheet_metadata, token, spreadsheet_id, tab_title
    )

    # '' is the legacy "first tab, unresolved" title left by the migration.
    result = await session.execute(
        select(DataSource).where(
            DataSource.connection_id == connection.id,
            DataSource.external_id == spreadsheet_id,
            DataSource.tab_title.in_([meta.tab_title, ""]),
        )
    )
    existing = sorted(result.scalars(), key=lambda s: s.tab_title == "")
    if existing:
        _apply_metadata(existing[0], meta)
        await session.commit()
        return existing[0]

    count = len(await list_sources(session, clerk_user_id))
    if count >= MAX_SOURCES_PER_USER:
        raise TooManySources(f"You can connect up to {MAX_SOURCES_PER_USER} sheets or tabs")

    source = DataSource(
        user_id=connection.user_id,
        connection_id=connection.id,
        provider=connection.provider,
        external_id=spreadsheet_id,
    )
    _apply_metadata(source, meta)
    session.add(source)
    try:
        await session.commit()
    except IntegrityError:
        # Two concurrent adds of the same tab: the other request won — return its row.
        await session.rollback()
        result = await session.execute(
            select(DataSource).where(
                DataSource.connection_id == connection.id,
                DataSource.external_id == spreadsheet_id,
                DataSource.tab_title == meta.tab_title,
            )
        )
        return result.scalar_one()
    return source


async def remove_source(session: AsyncSession, clerk_user_id: str, source_id: uuid.UUID) -> None:
    source = await get_source(session, clerk_user_id, source_id)
    await session.delete(source)  # chats keep their transcript (FK is SET NULL)
    await session.commit()


async def refresh_stale_sources(session: AsyncSession, clerk_user_id: str) -> list[DataSource]:
    """Best-effort refresh of sources whose cached stats are older than STATS_TTL.
    Reads run concurrently (bounded); writes happen serially on the session.
    A failed source keeps its cached values and is retried on the next call."""
    sources = await list_sources(session, clerk_user_id)
    cutoff = datetime.now(UTC) - STATS_TTL
    stale = [s for s in sources if s.synced_at < cutoff or not s.tab_title]
    if not stale:
        return sources

    try:
        _, token = await _connection_and_token(session, clerk_user_id)
    except NotFoundError:
        return sources

    gate = asyncio.Semaphore(_REFRESH_CONCURRENCY)

    async def fetch(source: DataSource) -> google_sheets.SheetMetadata | None:
        async with gate:
            try:
                return await asyncio.to_thread(
                    google_sheets.fetch_sheet_metadata,
                    token,
                    source.external_id,
                    source.tab_title or None,
                )
            except Exception:
                logger.warning("source_refresh_failed", source_id=str(source.id), exc_info=True)
                return None

    results = await asyncio.gather(*(fetch(s) for s in stale))
    changed = False
    for source, meta in zip(stale, results, strict=True):
        if meta is not None:
            _apply_metadata(source, meta)
            changed = True
    if changed:
        await session.commit()
    return sources


async def preview(
    session: AsyncSession, clerk_user_id: str, source_id: uuid.UUID, max_rows: int = 25
) -> google_sheets.SheetPreview:
    source = await get_source(session, clerk_user_id, source_id)
    _, token = await _connection_and_token(session, clerk_user_id)
    return await asyncio.to_thread(
        google_sheets.fetch_sheet_preview,
        token,
        source.external_id,
        source.tab_title or None,
        max_rows,
    )
