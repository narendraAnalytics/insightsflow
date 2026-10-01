"""Sending an AI-drafted email, after the user approves it on the draft card.

Two approval paths, both started by the user's click on the card — the agent's
`draft_email` tool only produces a draft and can never send:
  * `send_draft` — Send now.
  * `scheduled_email_service.schedule_draft` — Schedule (sent later by the pinger).
No FastAPI imports."""

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, NotFoundError
from app.db.models.chat import ChatMessage
from app.db.models.connection import Connection
from app.integrations.google import gmail as google_gmail
from app.services import chat_service, connection_service

logger = structlog.get_logger(__name__)


class DraftAlreadySent(AppError):
    status_code = 409
    code = "draft_already_sent"


class DraftAlreadyScheduled(AppError):
    status_code = 409
    code = "draft_already_scheduled"


class GmailNotSendable(AppError):
    status_code = 400
    code = "gmail_not_sendable"


async def locate_draft(
    session: AsyncSession, conversation_id: uuid.UUID, step_id: str
) -> tuple[ChatMessage, int]:
    """The assistant message + step index holding this draft. Locks the message
    rows (FOR UPDATE) so concurrent sends/schedules/cancels of one draft serialise.
    `step_id` must be a draft the agent really produced in this conversation, so
    callers can't be used as a generic "send any email" API."""
    result = await session.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id, ChatMessage.role == "assistant")
        .with_for_update()
    )
    target: tuple[ChatMessage, int] | None = None
    for message in result.scalars():
        for index, step in enumerate(message.steps or []):
            if step.get("id") == step_id and isinstance(step.get("draft"), dict):
                target = (message, index)
    if target is None:
        raise NotFoundError("Draft not found")
    return target


def ensure_unsent(draft: dict[str, Any]) -> None:
    """Only a fresh (or failed) draft may be sent or scheduled."""
    if draft.get("kind"):  # Slack/Notion drafts have their own services, never emailed
        raise NotFoundError("Draft not found")
    if draft.get("status") == "sent":
        raise DraftAlreadySent("This email was already sent.")
    if draft.get("status") == "scheduled":
        raise DraftAlreadyScheduled(
            "This email is already scheduled. Cancel it first to change it."
        )


async def require_send_connection(session: AsyncSession, clerk_user_id: str) -> Connection:
    try:
        connection = await connection_service.get_connection(session, clerk_user_id, "gmail")
    except NotFoundError:
        raise GmailNotSendable("Connect Gmail on the Integrations page to send email.") from None
    if connection.status != "connected" or not google_gmail.has_send_scope(connection.scopes):
        raise GmailNotSendable("Gmail isn't connected with permission to send. Reconnect it.")
    return connection


def set_step_draft(message: ChatMessage, index: int, draft: dict[str, Any]) -> None:
    """Replaces one step's draft. Assigns a NEW `steps` list so SQLAlchemy sees the
    JSONB change."""
    steps = [dict(s) for s in message.steps]
    steps[index]["draft"] = draft
    message.steps = steps


async def send_draft(
    session: AsyncSession,
    clerk_user_id: str,
    conversation_id: uuid.UUID,
    step_id: str,
    to: str,
    subject: str,
    body: str,
) -> dict[str, Any]:
    """Sends the user's final (possibly edited) version of a draft now and marks it sent."""
    # Ownership check (raises NotFoundError for someone else's conversation).
    await chat_service.get_owned_conversation(session, clerk_user_id, conversation_id)

    message, index = await locate_draft(session, conversation_id, step_id)
    ensure_unsent(message.steps[index]["draft"])

    connection = await require_send_connection(session, clerk_user_id)
    access_token = await connection_service.get_valid_access_token(session, connection)

    gmail_id = await asyncio.to_thread(google_gmail.send_message, access_token, to, subject, body)

    # Record what was actually sent (the user's edits), and that it can't be sent again.
    sent_at = datetime.now(UTC).isoformat()
    set_step_draft(
        message,
        index,
        {
            "to": google_gmail.parse_recipient(to) or to,
            "subject": google_gmail.clean_subject(subject),
            "body": google_gmail.clean_body(body),
            "status": "sent",
            "sent_at": sent_at,
        },
    )
    await session.commit()
    logger.info("email_sent", conversation_id=str(conversation_id), gmail_id=gmail_id)
    return {"status": "sent", "sent_at": sent_at}
