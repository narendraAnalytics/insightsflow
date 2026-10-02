"""Business logic for provider connections (DB + integrations/, no FastAPI
imports — see backend/CLAUDE.md's layering convention). Google Sheets is
the first provider; Connection.provider distinguishes others later.
"""

import asyncio
import uuid
from datetime import UTC, datetime

import structlog
from google.auth.exceptions import RefreshError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_token, encrypt_token
from app.core.errors import AppError, NotFoundError
from app.db.models.connection import Connection
from app.db.models.user import User
from app.integrations.google import gmail as google_gmail
from app.integrations.google import sheets as google_sheets

logger = structlog.get_logger(__name__)


class ConnectionExpired(AppError):
    status_code = 409
    code = "connection_expired"


# Providers that may have several accounts per user (Gmail first, then Slack).
MULTI_ACCOUNT_PROVIDERS = ("gmail", "slack")


class TooManyAccounts(AppError):
    status_code = 409
    code = "too_many_accounts"


# Gmail may have several accounts per user; this keeps one user from piling up connections.
MAX_ACCOUNTS_PER_PROVIDER = 5


def is_default(connection: Connection) -> bool:
    """The user's chosen account for a provider that allows several (Gmail)."""
    return bool((connection.config or {}).get("default"))


async def provider_connections(
    session: AsyncSession, user_id: uuid.UUID, provider: str
) -> list[Connection]:
    """All of a user's connections for one provider: the default first, then oldest first."""
    result = await session.execute(
        select(Connection)
        .where(Connection.user_id == user_id, Connection.provider == provider)
        .order_by(Connection.created_at)
    )
    return sorted(result.scalars(), key=lambda c: not is_default(c))  # stable sort


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


# provider -> module exposing build_auth_url(state, cv) / exchange_code(code, cv).
_OAUTH_CLIENTS = {"google_sheets": google_sheets, "gmail": google_gmail}


async def start_google_connect(clerk_user_id: str, provider: str = "google_sheets") -> str:
    from app.core.oauth_state import sign_state

    code_verifier = google_sheets.generate_code_verifier()
    state = sign_state(clerk_user_id, code_verifier)
    client = _OAUTH_CLIENTS[provider]
    return await asyncio.to_thread(client.build_auth_url, state, code_verifier)


async def complete_google_connect(
    session: AsyncSession,
    clerk_user_id: str,
    code: str,
    code_verifier: str,
    provider: str = "google_sheets",
) -> Connection:
    user = await get_or_create_user(session, clerk_user_id)
    client = _OAUTH_CLIENTS[provider]
    tokens = await asyncio.to_thread(client.exchange_code, code, code_verifier)

    access_enc, access_version = encrypt_token(tokens.access_token)
    refresh_enc, refresh_version = encrypt_token(tokens.refresh_token)
    assert access_version == refresh_version  # same key used for both, by construction

    existing = await provider_connections(session, user.id, provider)
    connection: Connection | None = None
    if provider == "gmail":
        # Several Gmail accounts are allowed. Match by address: reconnecting the SAME account
        # refreshes it (free); a different address becomes a new account.
        connection = next(
            (c for c in existing if tokens.email and c.external_account_email == tokens.email),
            None,
        )
    elif existing:
        connection = existing[0]
    if connection is None:
        if provider == "gmail" and len(existing) >= MAX_ACCOUNTS_PER_PROVIDER:
            raise TooManyAccounts(
                f"You can connect up to {MAX_ACCOUNTS_PER_PROVIDER} Gmail accounts. "
                "Disconnect one first."
            )
        connection = Connection(user_id=user.id, provider=provider)
        if provider == "gmail" and not existing:
            connection.config = {"default": True}
        if provider != "google_sheets":
            # Sheets are charged per sheet/tab added, not for the OAuth itself.
            # Local import: credit_service imports this module. The debit shares the
            # commit below, so a failed save never costs credits. It runs BEFORE the row is
            # added: spend() flushes, and a new connection can't be flushed until its
            # (NOT NULL) token fields are filled in below.
            from app.services import credit_service

            await credit_service.spend(
                session, user.id, credit_service.CONNECT_COST, f"connect_{provider}", commit=False
            )
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
    session: AsyncSession,
    clerk_user_id: str,
    provider: str = "google_sheets",
    connection_id: uuid.UUID | None = None,
) -> Connection:
    """One of the user's connections: the one with `connection_id`, else the default
    (for a provider with several accounts) or the only one."""
    user = await get_or_create_user(session, clerk_user_id)
    rows = await provider_connections(session, user.id, provider)
    if connection_id is not None:
        rows = [c for c in rows if c.id == connection_id]
    if not rows:
        raise NotFoundError(f"No {provider} connection for this user")
    return rows[0]


async def get_valid_access_token(session: AsyncSession, connection: Connection) -> str:
    """Returns a currently-valid access token, refreshing via the stored
    refresh token first if the cached one has expired."""
    now = datetime.now(UTC)
    # expires_at is null for tokens that never expire (Slack bot tokens).
    if connection.expires_at is None or connection.expires_at > now:
        return decrypt_token(connection.access_token_enc, connection.key_version)

    if connection.refresh_token_enc is None:
        raise NotFoundError(f"The {connection.provider} connection has expired. Reconnect it.")
    refresh_token = decrypt_token(connection.refresh_token_enc, connection.key_version)
    try:
        access_token, expires_at = await asyncio.to_thread(
            google_sheets.refresh_access_token, refresh_token, connection.scopes.split(",")
        )
    except RefreshError:
        # Google refused the refresh token (revoked, or expired: while the OAuth app is in
        # "Testing" they last 7 days). Mark it so the UI offers Connect again; reconnecting
        # reuses this row, so chats and sheets stay attached.
        logger.warning("google_refresh_rejected", provider=connection.provider)
        connection.status = "expired"
        await session.commit()
        raise ConnectionExpired(
            f"Your {connection.provider.replace('_', ' ')} access expired. Reconnect it."
        ) from None
    access_enc, version = encrypt_token(access_token)
    connection.access_token_enc = access_enc
    connection.key_version = version
    connection.expires_at = expires_at
    await session.commit()
    return access_token


async def list_connections(session: AsyncSession, clerk_user_id: str) -> list[Connection]:
    user = await get_or_create_user(session, clerk_user_id)
    result = await session.execute(
        select(Connection).where(Connection.user_id == user.id).order_by(Connection.created_at)
    )
    return list(result.scalars())


async def disconnect(
    session: AsyncSession,
    clerk_user_id: str,
    provider: str = "google_sheets",
    connection_id: uuid.UUID | None = None,
) -> None:
    connection = await get_connection(session, clerk_user_id, provider, connection_id)
    was_default = is_default(connection)
    user_id, doomed = connection.user_id, connection.id
    await session.delete(connection)
    if was_default:
        # Hand the default to the oldest remaining account so one is always chosen.
        rows = await provider_connections(session, user_id, provider)
        remaining = [c for c in rows if c.id != doomed]
        if remaining:
            remaining[0].config = {**(remaining[0].config or {}), "default": True}
    await session.commit()


async def set_default(
    session: AsyncSession,
    clerk_user_id: str,
    connection_id: uuid.UUID,
    provider: str = "gmail",
) -> None:
    """Makes one account the default for its provider (Gmail, Slack): the one drafts use
    unless the draft card picks another."""
    user = await get_or_create_user(session, clerk_user_id)
    rows = await provider_connections(session, user.id, provider)
    if not any(c.id == connection_id for c in rows):
        raise NotFoundError(f"{provider.title()} account not found")
    for c in rows:
        c.config = {**(c.config or {}), "default": c.id == connection_id}
    await session.commit()
