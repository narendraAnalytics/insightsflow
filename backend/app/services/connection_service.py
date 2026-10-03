"""Business logic for provider connections (DB + integrations/, no FastAPI
imports — see backend/CLAUDE.md's layering convention). Google Sheets is
the first provider; Connection.provider distinguishes others later.
"""

import asyncio
import secrets
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


# Providers that may have several accounts per user (Gmail first, then Slack, Notion).
MULTI_ACCOUNT_PROVIDERS = ("gmail", "slack", "notion", "google_sheets")


class TooManyAccounts(AppError):
    status_code = 409
    code = "too_many_accounts"


# Gmail may have several accounts per user; this keeps one user from piling up connections.
MAX_ACCOUNTS_PER_PROVIDER = 5


# Slack/Notion workspaces can belong to one of the user's Gmail accounts (a "profile"):
# the Gmail connection's id lives in the workspace's `config`, so no migration is needed.
GMAIL_LINK_KEY = "gmail_connection_id"
LINKED_PROVIDERS = ("slack", "notion", "google_sheets")


def linked_gmail(connection: Connection) -> str | None:
    return (connection.config or {}).get(GMAIL_LINK_KEY) or None


def for_gmail[T: Connection](rows: list[T], gmail_id: uuid.UUID | str | None) -> list[T]:
    """The workspaces that belong to this Gmail account. When none of the user's workspaces
    is linked to any Gmail (connected before linking existed), all of them are returned so
    nothing disappears."""
    if not any(linked_gmail(c) for c in rows):
        return rows
    return [c for c in rows if gmail_id is not None and linked_gmail(c) == str(gmail_id)]


async def effective_gmail_id(
    session: AsyncSession, user_id: uuid.UUID, gmail_connection_id: uuid.UUID | None
) -> uuid.UUID | None:
    """The Gmail account a chat works as: the chosen one, else the user's default."""
    if gmail_connection_id is not None:
        return gmail_connection_id
    rows = await provider_connections(session, user_id, "gmail")
    return rows[0].id if rows else None


async def valid_gmail_link(
    session: AsyncSession, user_id: uuid.UUID, gmail_connection_id: uuid.UUID | None
) -> str | None:
    """`gmail_connection_id` as a string if it is one of this user's Gmail accounts."""
    if gmail_connection_id is None:
        return None
    rows = await provider_connections(session, user_id, "gmail")
    return str(gmail_connection_id) if any(c.id == gmail_connection_id for c in rows) else None


def gmail_link_state(gmail_connection_id: uuid.UUID | None) -> str:
    """What rides in the OAuth state's `cv` slot (a nonce otherwise) to link a new workspace."""
    return f"gmail:{gmail_connection_id}" if gmail_connection_id else secrets.token_urlsafe(16)


def gmail_link_from_state(cv: str) -> uuid.UUID | None:
    if not cv.startswith("gmail:"):
        return None
    try:
        return uuid.UUID(cv.removeprefix("gmail:"))
    except ValueError:
        return None


async def set_gmail_link(
    session: AsyncSession,
    clerk_user_id: str,
    provider: str,
    connection_id: uuid.UUID,
    gmail_connection_id: uuid.UUID | None,
) -> None:
    """Moves a Slack/Notion workspace to another Gmail account, or to none."""
    user = await get_or_create_user(session, clerk_user_id)
    link = await valid_gmail_link(session, user.id, gmail_connection_id)
    if gmail_connection_id is not None and link is None:
        raise NotFoundError("Gmail account not found")
    connection = await get_connection(session, clerk_user_id, provider, connection_id)
    config = {k: v for k, v in (connection.config or {}).items() if k != GMAIL_LINK_KEY}
    if link:
        config[GMAIL_LINK_KEY] = link
    connection.config = config  # a NEW dict so SQLAlchemy sees the JSONB change
    await session.commit()


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
    if provider in ("gmail", "google_sheets"):
        # Several Google accounts are allowed. Match by address: reconnecting the SAME account
        # refreshes it (free); a different address becomes a new account.
        connection = next(
            (c for c in existing if tokens.email and c.external_account_email == tokens.email),
            None,
        )
        if connection is None and provider == "google_sheets" and len(existing) == 1:
            # A login saved before addresses were recorded: refresh it rather than duplicate it.
            if not existing[0].external_account_email:
                connection = existing[0]
    elif existing:
        connection = existing[0]
    if connection is None:
        if provider in ("gmail", "google_sheets") and len(existing) >= MAX_ACCOUNTS_PER_PROVIDER:
            noun = "Gmail accounts" if provider == "gmail" else "Google accounts for Sheets"
            raise TooManyAccounts(
                f"You can connect up to {MAX_ACCOUNTS_PER_PROVIDER} {noun}. Disconnect one first."
            )
        connection = Connection(user_id=user.id, provider=provider)
        if provider in ("gmail", "google_sheets") and not existing:
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
    await _link_matching_addresses(session, user.id, connection)
    return connection


async def _link_matching_addresses(
    session: AsyncSession, user_id: uuid.UUID, connection: Connection
) -> None:
    """A Sheets login and a Gmail account with the SAME Google address are the same person, so
    they are linked (Sheets belongs to that Gmail). Only fills a missing link."""
    email = connection.external_account_email
    if not email or connection.provider not in ("gmail", "google_sheets"):
        return
    other = "gmail" if connection.provider == "google_sheets" else "google_sheets"
    changed = False
    for row in await provider_connections(session, user_id, other):
        sheets, gmail = (connection, row) if other == "gmail" else (row, connection)
        if row.external_account_email == email and not linked_gmail(sheets):
            sheets.config = {**(sheets.config or {}), GMAIL_LINK_KEY: str(gmail.id)}
            changed = True
    if changed:
        await session.commit()


async def autolink_sheets(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Links Sheets logins connected before linking existed to the Gmail account with the
    same address. Idempotent; run when the connections list is read."""
    rows = await provider_connections(session, user_id, "google_sheets")
    for row in rows:
        if not linked_gmail(row):
            await _link_matching_addresses(session, user_id, row)


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
    if provider == "gmail":
        # Workspaces that belonged to this Gmail account become unlinked.
        for p in LINKED_PROVIDERS:
            for c in await provider_connections(session, user_id, p):
                if linked_gmail(c) == str(doomed):
                    c.config = {k: v for k, v in (c.config or {}).items() if k != GMAIL_LINK_KEY}
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
