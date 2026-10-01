"""Slack connections and approved posts (DB + integrations/, no FastAPI imports).

One Slack app serves every user; each user's install into THEIR workspace is a
`connections` row with provider="slack" (bot token encrypted at rest, workspace and
default channel in `config`). The agent can only DRAFT a message (`draft_slack_message`);
`send_draft` — called from the user's click on the draft card — is the only way
anything is posted.
"""

import asyncio
import secrets
import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_token, encrypt_token
from app.core.errors import AppError, NotFoundError
from app.core.oauth_state import sign_state
from app.db.models.connection import Connection
from app.integrations import slack
from app.services import chat_service, connection_service, email_service

logger = structlog.get_logger(__name__)

PROVIDER = "slack"


class SlackNotConnected(AppError):
    status_code = 400
    code = "slack_not_connected"


class SlackChannelRequired(AppError):
    status_code = 400
    code = "slack_channel_required"


class SlackDraftAlreadySent(AppError):
    status_code = 409
    code = "draft_already_sent"


def start_connect(clerk_user_id: str) -> str:
    """The Slack install URL. Slack has no PKCE, so the state's `cv` slot just carries
    a random nonce; the HMAC signature + 10-minute expiry are the CSRF protection."""
    return slack.build_auth_url(sign_state(clerk_user_id, secrets.token_urlsafe(16)))


async def complete_connect(session: AsyncSession, clerk_user_id: str, code: str) -> Connection:
    user = await connection_service.get_or_create_user(session, clerk_user_id)
    install = await asyncio.to_thread(slack.exchange_code, code)
    token_enc, key_version = encrypt_token(install.bot_token)

    result = await session.execute(
        select(Connection).where(Connection.user_id == user.id, Connection.provider == PROVIDER)
    )
    connection = result.scalar_one_or_none()
    if connection is None:
        connection = Connection(user_id=user.id, provider=PROVIDER)
        session.add(connection)

    previous = connection.config or {}
    config: dict[str, Any] = {"team_id": install.team_id, "team_name": install.team_name}
    # Reconnecting to the SAME workspace keeps the chosen channel; a different one resets it.
    if previous.get("team_id") == install.team_id:
        for key in ("channel_id", "channel_name"):
            if previous.get(key):
                config[key] = previous[key]

    connection.status = "connected"
    connection.external_account_email = install.team_name  # shown as the account label
    connection.access_token_enc = token_enc
    connection.refresh_token_enc = None
    connection.expires_at = None
    connection.scopes = ",".join(install.scopes)
    connection.key_version = key_version
    connection.config = config

    await session.commit()
    await session.refresh(connection)
    return connection


async def _connection_and_token(
    session: AsyncSession, clerk_user_id: str
) -> tuple[Connection, str]:
    try:
        connection = await connection_service.get_connection(session, clerk_user_id, PROVIDER)
    except NotFoundError:
        raise SlackNotConnected("Connect Slack on the Integrations page first.") from None
    if connection.status != "connected":
        raise SlackNotConnected("Slack isn't connected. Reconnect it on the Integrations page.")
    return connection, decrypt_token(connection.access_token_enc, connection.key_version)


async def list_channels(session: AsyncSession, clerk_user_id: str) -> list[slack.SlackChannel]:
    _, token = await _connection_and_token(session, clerk_user_id)
    return await asyncio.to_thread(slack.list_channels, token)


async def set_channel(session: AsyncSession, clerk_user_id: str, channel_id: str) -> dict[str, Any]:
    """Saves the default channel. Only a channel that really is in the user's workspace
    list can be chosen, and its name is taken from Slack, not from the client."""
    connection, token = await _connection_and_token(session, clerk_user_id)
    channels = await asyncio.to_thread(slack.list_channels, token)
    chosen = next((c for c in channels if c.id == channel_id), None)
    if chosen is None:
        raise SlackChannelRequired("That channel isn't in your Slack workspace.")
    # A NEW dict so SQLAlchemy sees the JSONB change.
    connection.config = {
        **(connection.config or {}),
        "channel_id": chosen.id,
        "channel_name": chosen.name,
    }
    await session.commit()
    return connection.config


async def default_channel(session: AsyncSession, clerk_user_id: str) -> dict[str, str] | None:
    """{id, name} of the default channel if Slack is connected and one is chosen.
    Never raises — it only decides whether the agent may offer `draft_slack_message`."""
    try:
        connection = await connection_service.get_connection(session, clerk_user_id, PROVIDER)
    except NotFoundError:
        return None
    cfg = connection.config or {}
    if connection.status != "connected" or not cfg.get("channel_id"):
        return None
    return {"id": cfg["channel_id"], "name": cfg.get("channel_name", "")}


async def disconnect(session: AsyncSession, clerk_user_id: str) -> None:
    connection = await connection_service.get_connection(session, clerk_user_id, PROVIDER)
    try:
        token = decrypt_token(connection.access_token_enc, connection.key_version)
        await asyncio.to_thread(slack.revoke, token)  # best effort
    except Exception:
        logger.warning("slack_revoke_failed", exc_info=True)
    await session.delete(connection)
    await session.commit()


async def send_draft(
    session: AsyncSession,
    clerk_user_id: str,
    conversation_id: uuid.UUID,
    step_id: str,
    channel_id: str,
    text: str,
) -> dict[str, Any]:
    """Posts the user's final (possibly edited) message and marks the draft sent."""
    await chat_service.get_owned_conversation(session, clerk_user_id, conversation_id)

    message, index = await email_service.locate_draft(session, conversation_id, step_id)
    draft = message.steps[index]["draft"]
    if draft.get("kind") != "slack":
        raise NotFoundError("Draft not found")
    if draft.get("status") == "sent":
        raise SlackDraftAlreadySent("This message was already posted.")

    channel_id, text = slack.validated_message(channel_id, text)
    connection, token = await _connection_and_token(session, clerk_user_id)
    cfg = connection.config or {}
    if cfg.get("channel_id") == channel_id:
        channel_name = cfg.get("channel_name", "")
    else:
        channels = await asyncio.to_thread(slack.list_channels, token)
        chosen = next((c for c in channels if c.id == channel_id), None)
        if chosen is None:
            raise SlackChannelRequired("Pick a channel from your Slack workspace.")
        channel_name = chosen.name

    ts = await asyncio.to_thread(slack.post_message, token, channel_id, text)

    sent_at = datetime.now(UTC).isoformat()
    email_service.set_step_draft(
        message,
        index,
        {
            "kind": "slack",
            "channel_id": channel_id,
            "channel_name": channel_name,
            "text": text,
            "status": "sent",
            "sent_at": sent_at,
        },
    )
    await session.commit()
    logger.info("slack_posted", conversation_id=str(conversation_id), ts=ts)
    return {"status": "sent", "sent_at": sent_at, "channel_name": channel_name}
