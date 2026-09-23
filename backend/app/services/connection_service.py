"""Business logic for provider connections (DB + integrations/, no FastAPI
imports — see backend/CLAUDE.md's layering convention). Google Sheets is
the first provider; Connection.provider distinguishes others later.
"""

import asyncio
from datetime import UTC, datetime

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_token, encrypt_token
from app.core.errors import NotFoundError
from app.db.models.connection import Connection
from app.db.models.user import User
from app.integrations.google import sheets as google_sheets

logger = structlog.get_logger(__name__)


async def get_or_create_user(session: AsyncSession, clerk_user_id: str) -> User:
    """Looks up the synced `users` row for the current principal. Normally
    populated by the Clerk webhook (app/api/v1/webhooks/clerk.py), but that
    can lag in local dev without a running ngrok tunnel — creates a minimal
    row on demand rather than 404ing, so this feature doesn't silently
    depend on webhook timing."""
    result = await session.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    user = User(clerk_user_id=clerk_user_id)
    session.add(user)
    await session.flush()
    return user


async def start_google_connect(clerk_user_id: str) -> str:
    from app.core.oauth_state import sign_state

    code_verifier = google_sheets.generate_code_verifier()
    state = sign_state(clerk_user_id, code_verifier)
    return await asyncio.to_thread(google_sheets.build_auth_url, state, code_verifier)


async def complete_google_connect(
    session: AsyncSession, clerk_user_id: str, code: str, code_verifier: str
) -> Connection:
    user = await get_or_create_user(session, clerk_user_id)
    tokens = await asyncio.to_thread(google_sheets.exchange_code, code, code_verifier)

    access_enc, access_version = encrypt_token(tokens.access_token)
    refresh_enc, refresh_version = encrypt_token(tokens.refresh_token)
    assert access_version == refresh_version  # same key used for both, by construction

    result = await session.execute(
        select(Connection).where(
            Connection.user_id == user.id, Connection.provider == "google_sheets"
        )
    )
    connection = result.scalar_one_or_none()
    if connection is None:
        connection = Connection(user_id=user.id, provider="google_sheets")
        session.add(connection)

    connection.status = "connected"
    connection.external_account_email = tokens.email
    connection.access_token_enc = access_enc
    connection.refresh_token_enc = refresh_enc
    connection.expires_at = tokens.expires_at
    connection.scopes = ",".join(tokens.scopes)
    connection.key_version = access_version

    await session.commit()
    await session.refresh(connection)
    return connection


async def get_connection(
    session: AsyncSession, clerk_user_id: str, provider: str = "google_sheets"
) -> Connection:
    user = await get_or_create_user(session, clerk_user_id)
    result = await session.execute(
        select(Connection).where(Connection.user_id == user.id, Connection.provider == provider)
    )
    connection = result.scalar_one_or_none()
    if connection is None:
        raise NotFoundError(f"No {provider} connection for this user")
    return connection


async def get_valid_access_token(session: AsyncSession, connection: Connection) -> str:
    """Returns a currently-valid access token, refreshing via the stored
    refresh token first if the cached one has expired."""
    now = datetime.now(UTC)
    if connection.expires_at > now:
        return decrypt_token(connection.access_token_enc, connection.key_version)

    refresh_token = decrypt_token(connection.refresh_token_enc, connection.key_version)
    access_token, expires_at = await asyncio.to_thread(
        google_sheets.refresh_access_token, refresh_token, connection.scopes.split(",")
    )
    access_enc, version = encrypt_token(access_token)
    connection.access_token_enc = access_enc
    connection.key_version = version
    connection.expires_at = expires_at
    await session.commit()
    return access_token


async def select_sheet(
    session: AsyncSession, clerk_user_id: str, file_id: str, file_name: str
) -> Connection:
    connection = await get_connection(session, clerk_user_id)
    access_token = await get_valid_access_token(session, connection)
    metadata = await asyncio.to_thread(google_sheets.fetch_sheet_metadata, access_token, file_id)

    connection.google_sheet_id = file_id
    connection.google_sheet_name = metadata.name or file_name
    connection.google_sheet_headers = metadata.headers
    connection.google_sheet_row_count = metadata.row_count

    await session.commit()
    await session.refresh(connection)
    return connection


async def refresh_sheet_stats(session: AsyncSession, connection: Connection) -> None:
    """Best-effort: recompute the stored row/column counts from the live sheet
    so counts saved by an older version (or edits made in Sheets since) don't
    go stale. Never raises — a failed refresh just keeps the stored values."""
    if not connection.google_sheet_id:
        return
    try:
        access_token = await get_valid_access_token(session, connection)
        metadata = await asyncio.to_thread(
            google_sheets.fetch_sheet_metadata, access_token, connection.google_sheet_id
        )
    except Exception:
        logger.warning("sheet_stats_refresh_failed", exc_info=True)
        return
    if (
        metadata.row_count != connection.google_sheet_row_count
        or metadata.headers != connection.google_sheet_headers
    ):
        connection.google_sheet_row_count = metadata.row_count
        connection.google_sheet_headers = metadata.headers
        await session.commit()
        await session.refresh(connection)


async def get_sheet_preview(
    session: AsyncSession, clerk_user_id: str, max_rows: int = 25
) -> google_sheets.SheetPreview:
    connection = await get_connection(session, clerk_user_id)
    if not connection.google_sheet_id:
        raise NotFoundError("No spreadsheet selected for this connection yet")
    access_token = await get_valid_access_token(session, connection)
    return await asyncio.to_thread(
        google_sheets.fetch_sheet_preview, access_token, connection.google_sheet_id, max_rows
    )


async def disconnect(session: AsyncSession, clerk_user_id: str) -> None:
    connection = await get_connection(session, clerk_user_id)
    await session.delete(connection)
    await session.commit()
