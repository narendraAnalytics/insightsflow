"""Notion connections and approved saves (DB + integrations/, no FastAPI imports).

One Notion public connection serves every user; each user's install into THEIR workspace
is a `connections` row with provider="notion" (access + refresh token encrypted at rest;
workspace and the chosen parent page in `config`). The agent can only DRAFT a page
(`draft_notion_page`); `save_draft` — called from the user's click on the draft card — is
the only way anything is written to Notion.
"""

import asyncio
import secrets
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_token, encrypt_token
from app.core.errors import AppError, NotFoundError
from app.core.oauth_state import sign_state
from app.db.models.connection import Connection
from app.integrations import notion
from app.services import chat_service, connection_service, credit_service, email_service

logger = structlog.get_logger(__name__)

PROVIDER = "notion"


class NotionNotConnected(AppError):
    status_code = 400
    code = "notion_not_connected"


class NotionDraftAlreadySaved(AppError):
    status_code = 409
    code = "draft_already_sent"


def start_connect(clerk_user_id: str) -> str:
    """The Notion consent URL. Notion's `state` is our signed token (HMAC + 10-minute
    expiry = CSRF protection); the `cv` slot just carries a random nonce, as for Slack."""
    return notion.build_auth_url(sign_state(clerk_user_id, secrets.token_urlsafe(16)))


async def complete_connect(session: AsyncSession, clerk_user_id: str, code: str) -> Connection:
    user = await connection_service.get_or_create_user(session, clerk_user_id)
    install = await asyncio.to_thread(notion.exchange_code, code)
    access_enc, key_version = encrypt_token(install.access_token)
    refresh_enc = encrypt_token(install.refresh_token)[0] if install.refresh_token else None

    result = await session.execute(
        select(Connection).where(Connection.user_id == user.id, Connection.provider == PROVIDER)
    )
    connection = result.scalar_one_or_none()
    if connection is None:
        connection = Connection(user_id=user.id, provider=PROVIDER)
        session.add(connection)
        await credit_service.spend(
            session, user.id, credit_service.CONNECT_COST, f"connect_{PROVIDER}", commit=False
        )

    previous = connection.config or {}
    config: dict[str, Any] = {
        "workspace_id": install.workspace_id,
        "workspace_name": install.workspace_name,
        "bot_id": install.bot_id,
    }
    # Reconnecting to the SAME workspace keeps the chosen page; a different one resets it.
    if previous.get("workspace_id") == install.workspace_id:
        for key in ("page_id", "page_title"):
            if previous.get(key):
                config[key] = previous[key]

    connection.status = "connected"
    connection.external_account_email = install.workspace_name  # shown as the account label
    connection.access_token_enc = access_enc
    connection.refresh_token_enc = refresh_enc
    connection.expires_at = None  # refreshed on a 401 instead of by clock
    connection.scopes = "insert_content"
    connection.key_version = key_version
    connection.config = config

    await session.commit()
    await session.refresh(connection)
    return connection


async def _get(session: AsyncSession, clerk_user_id: str) -> Connection:
    try:
        connection = await connection_service.get_connection(session, clerk_user_id, PROVIDER)
    except NotFoundError:
        raise NotionNotConnected("Connect Notion on the Integrations page first.") from None
    if connection.status != "connected":
        raise NotionNotConnected("Notion isn't connected. Reconnect it on the Integrations page.")
    return connection


async def _call[T](
    session: AsyncSession, connection: Connection, fn: Callable[..., T], *args: Any
) -> T:
    """Runs a blocking Notion call with the stored token. On a 401 it refreshes the token
    pair once (saving the new one), then retries; if Notion refuses the refresh the user
    has to reconnect."""
    token = decrypt_token(connection.access_token_enc, connection.key_version)
    try:
        return await asyncio.to_thread(fn, token, *args)
    except notion.NotionTokenExpired:
        if not connection.refresh_token_enc:
            raise notion.NotionNeedsReconnect(
                "Notion needs to be reconnected on the Integrations page."
            ) from None
        refresh = decrypt_token(connection.refresh_token_enc, connection.key_version)
        new_access, new_refresh = await asyncio.to_thread(notion.refresh_tokens, refresh)
        # Both tokens are re-encrypted with the newest key (one key_version per row).
        connection.access_token_enc, connection.key_version = encrypt_token(new_access)
        connection.refresh_token_enc = encrypt_token(new_refresh or refresh)[0]
        await session.commit()
        return await asyncio.to_thread(fn, new_access, *args)


async def list_pages(
    session: AsyncSession, clerk_user_id: str, query: str = ""
) -> list[notion.NotionPage]:
    connection = await _get(session, clerk_user_id)
    return await _call(session, connection, notion.search_pages, query)


async def set_page(session: AsyncSession, clerk_user_id: str, page_id: str) -> dict[str, Any]:
    """Saves the parent page for approved reports. Notion is asked for the page itself, so
    only a page the connection can really reach can be chosen and the title is Notion's."""
    connection = await _get(session, clerk_user_id)
    page = await _call(session, connection, notion.get_page, page_id)
    # A NEW dict so SQLAlchemy sees the JSONB change.
    connection.config = {
        **(connection.config or {}),
        "page_id": page.id,
        "page_title": page.title,
    }
    await session.commit()
    return connection.config


async def default_page(session: AsyncSession, clerk_user_id: str) -> dict[str, str] | None:
    """{id, title} of the chosen parent page if Notion is connected and one is chosen.
    Never raises its own errors — it only decides whether the agent may offer
    `draft_notion_page`."""
    try:
        connection = await connection_service.get_connection(session, clerk_user_id, PROVIDER)
    except NotFoundError:
        return None
    cfg = connection.config or {}
    if connection.status != "connected" or not cfg.get("page_id"):
        return None
    return {"id": cfg["page_id"], "title": cfg.get("page_title", "")}


async def disconnect(session: AsyncSession, clerk_user_id: str) -> None:
    """Deletes our copy of the tokens. Notion has no revoke call we rely on, so the user can
    also remove the connection in Notion (Settings -> Connections)."""
    connection = await connection_service.get_connection(session, clerk_user_id, PROVIDER)
    await session.delete(connection)
    await session.commit()


async def save_draft(
    session: AsyncSession,
    clerk_user_id: str,
    conversation_id: uuid.UUID,
    step_id: str,
    title: str,
    body: str,
) -> dict[str, Any]:
    """Creates the Notion page from the user's final (possibly edited) draft and marks it
    saved. The parent page is the one stored on the draft — what the card showed — never
    a value from the request."""
    await chat_service.get_owned_conversation(session, clerk_user_id, conversation_id)

    message, index = await email_service.locate_draft(session, conversation_id, step_id)
    draft = message.steps[index]["draft"]
    if draft.get("kind") != "notion":
        raise NotFoundError("Draft not found")
    if draft.get("status") == "sent":
        raise NotionDraftAlreadySaved("This page was already saved to Notion.")

    page_id, title, body = notion.validated_page(draft.get("page_id", ""), title, body)
    connection = await _get(session, clerk_user_id)
    _, url = await _call(session, connection, notion.create_page, page_id, title, body)

    saved_at = datetime.now(UTC).isoformat()
    email_service.set_step_draft(
        message,
        index,
        {
            "kind": "notion",
            "page_id": page_id,
            "page_title": draft.get("page_title", ""),
            "title": title,
            "body": body,
            "status": "sent",
            "sent_at": saved_at,
            "url": url,
        },
    )
    await session.commit()
    logger.info("notion_page_saved", conversation_id=str(conversation_id))
    return {"status": "sent", "sent_at": saved_at, "url": url}
