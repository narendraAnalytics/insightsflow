"""Sending an AI-drafted email, after the user approves it on the draft card.

This is the ONLY code path that sends mail. The agent's `draft_email` tool just
produces a draft stored on the assistant message's step; nothing leaves the
account until the user clicks Send, which calls `send_draft` (human-in-the-loop).
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
from app.integrations.google import gmail as google_gmail
from app.services import chat_service, connection_service

logger = structlog.get_logger(__name__)


class DraftAlreadySent(AppError):
    status_code = 409
    code = "draft_already_sent"


class GmailNotSendable(AppError):
    status_code = 400
    code = "gmail_not_sendable"


async def send_draft(
    session: AsyncSession,
    clerk_user_id: str,
    conversation_id: uuid.UUID,
    step_id: str,
    to: str,
    subject: str,
    body: str,
) -> dict[str, Any]:
    """Sends the user's final (possibly edited) version of a draft and marks it sent.
    `step_id` must be a draft the agent really produced in this user's conversation,
    so the endpoint can't be used as a generic "send any email" API."""
    # Ownership check (raises NotFoundError for someone else's conversation).
    await chat_service.get_owned_conversation(session, clerk_user_id, conversation_id)

    # Lock the message rows so a double click can't send the same draft twice.
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
    message, index = target
    if message.steps[index]["draft"].get("status") == "sent":
        raise DraftAlreadySent("This email was already sent.")

    try:
        connection = await connection_service.get_connection(session, clerk_user_id, "gmail")
    except NotFoundError:
        raise GmailNotSendable("Connect Gmail on the Integrations page to send email.") from None
    if connection.status != "connected" or not google_gmail.has_send_scope(connection.scopes):
        raise GmailNotSendable("Gmail isn't connected with permission to send. Reconnect it.")
    access_token = await connection_service.get_valid_access_token(session, connection)

    gmail_id = await asyncio.to_thread(google_gmail.send_message, access_token, to, subject, body)

    # Record what was actually sent (the user's edits), and that it can't be sent again.
    sent_at = datetime.now(UTC).isoformat()
    steps = [dict(s) for s in message.steps]
    steps[index]["draft"] = {
        "to": google_gmail.parse_recipient(to) or to,
        "subject": google_gmail.clean_subject(subject),
        "body": google_gmail.clean_body(body),
        "status": "sent",
        "sent_at": sent_at,
    }
    message.steps = steps  # a new list, so SQLAlchemy sees the JSONB change
    await session.commit()
    logger.info("email_sent", conversation_id=str(conversation_id), gmail_id=gmail_id)
    return {"status": "sent", "sent_at": sent_at}
