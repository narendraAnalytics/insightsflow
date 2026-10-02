"""Scheduled sending of AI-drafted emails (no FastAPI imports).

The user's click on the draft card's "Schedule" button is the approval step: it
freezes the (possibly edited) content into a `scheduled_emails` row. Gmail's API
has no scheduled send, so an external once-a-minute pinger calls `run_due`, which
claims due rows and sends them from the user's own Gmail. The agent can never
schedule or send anything itself.

`run_due` never retries: a failed send is shown on the card so the user decides,
and a row left "sending" by a crash is failed (not re-sent) to avoid duplicates.
"""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from google.auth.exceptions import RefreshError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.errors import AppError, NotFoundError
from app.db.models.scheduled_email import ScheduledEmail
from app.db.session import get_sessionmaker
from app.integrations.google import gmail as google_gmail
from app.services import chat_service, connection_service, email_service
from app.services.connection_service import get_or_create_user

logger = structlog.get_logger(__name__)

MIN_LEAD = timedelta(minutes=2)
# Google OAuth apps in Testing mode get refresh tokens that expire after 7 days, so a
# longer schedule could not be sent. Revisit once the app is verified.
MAX_LEAD = timedelta(days=7)
STALE_AFTER = timedelta(minutes=10)
MAX_PER_RUN = 20


class InvalidScheduleTime(AppError):
    status_code = 400
    code = "invalid_schedule_time"


class ScheduleNotCancellable(AppError):
    status_code = 409
    code = "schedule_not_cancellable"


def validate_send_at(send_at: datetime, now: datetime | None = None) -> datetime:
    """The send time in UTC, or InvalidScheduleTime. Must carry a timezone (the UI
    sends IST as +05:30) and fall between MIN_LEAD and MAX_LEAD from now."""
    if send_at.tzinfo is None:
        raise InvalidScheduleTime("Pick a date and time to send.")
    now = now or datetime.now(UTC)
    when = send_at.astimezone(UTC)
    if when < now + MIN_LEAD:
        raise InvalidScheduleTime("Choose a time at least 2 minutes from now.")
    if when > now + MAX_LEAD:
        raise InvalidScheduleTime("You can schedule up to 7 days ahead.")
    return when


def _card(row: ScheduledEmail, status: str, **extra: Any) -> dict[str, Any]:
    return {
        "to": row.to_address,
        "subject": row.subject,
        "body": row.body,
        "status": status,
        **extra,
    }


async def schedule_draft(
    session: AsyncSession,
    clerk_user_id: str,
    conversation_id: uuid.UUID,
    step_id: str,
    to: str,
    subject: str,
    body: str,
    send_at: datetime,
    connection_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    when = validate_send_at(send_at)
    recipient, clean_subject, clean_body = google_gmail.validated_fields(to, subject, body)
    await chat_service.get_owned_conversation(session, clerk_user_id, conversation_id)

    message, index = await email_service.locate_draft(session, conversation_id, step_id)
    email_service.ensure_unsent(message.steps[index]["draft"])
    connection = await email_service.require_send_connection(session, clerk_user_id, connection_id)

    user = await get_or_create_user(session, clerk_user_id)
    row = ScheduledEmail(
        user_id=user.id,
        conversation_id=conversation_id,
        step_id=step_id,
        connection_id=connection.id,
        to_address=recipient,
        subject=clean_subject,
        body=clean_body,
        send_at=when,
        status="scheduled",
    )
    session.add(row)
    await session.flush()
    email_service.set_step_draft(
        message,
        index,
        _card(row, "scheduled", scheduled_id=str(row.id), send_at=when.isoformat()),
    )
    await session.commit()
    logger.info("email_scheduled", scheduled_id=str(row.id), send_at=when.isoformat())
    return {"id": str(row.id), "status": "scheduled", "send_at": when.isoformat()}


async def cancel(session: AsyncSession, clerk_user_id: str, scheduled_id: uuid.UUID) -> None:
    """Cancels a still-waiting email and turns its card back into an editable draft."""
    user = await get_or_create_user(session, clerk_user_id)
    result = await session.execute(
        select(ScheduledEmail)
        .where(ScheduledEmail.id == scheduled_id, ScheduledEmail.user_id == user.id)
        .with_for_update()
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Scheduled email not found")
    if row.status != "scheduled":
        raise ScheduleNotCancellable(f"This email can't be cancelled — it is already {row.status}.")
    row.status = "cancelled"
    await _update_card(session, row, _card(row, "draft"))
    await session.commit()


async def _update_card(session: AsyncSession, row: ScheduledEmail, draft: dict[str, Any]) -> None:
    """Mirrors the row's state onto the chat's draft card (if the chat still exists)."""
    if row.conversation_id is None:
        return
    try:
        message, index = await email_service.locate_draft(session, row.conversation_id, row.step_id)
    except NotFoundError:
        return
    email_service.set_step_draft(message, index, draft)


def _explain(exc: Exception) -> str:
    if isinstance(exc, AppError):
        return exc.message
    if isinstance(exc, RefreshError):
        return "Gmail rejected the saved login. Reconnect Gmail on the Integrations page."
    return "Couldn't send the email. Try again."


async def _fail_stale(session: AsyncSession, now: datetime) -> int:
    """Rows stuck in "sending" (the process died mid-send) become failed, NOT re-sent:
    the mail may already have gone out, so the user checks their Sent folder."""
    result = await session.execute(
        select(ScheduledEmail)
        .where(ScheduledEmail.status == "sending", ScheduledEmail.claimed_at < now - STALE_AFTER)
        .with_for_update(skip_locked=True)
    )
    rows = list(result.scalars())
    for row in rows:
        row.status = "failed"
        row.error = "Sending was interrupted. Check your Gmail Sent folder before sending again."
        await _update_card(session, row, _card(row, "failed", error=row.error))
    if rows:
        await session.commit()
    return len(rows)


async def _deliver(
    maker: async_sessionmaker[AsyncSession], row_id: uuid.UUID, now: datetime
) -> bool:
    """Sends one claimed row. Returns True if sent, False if it failed."""
    async with maker() as session:
        row = await session.get(ScheduledEmail, row_id)
        if row is None or row.status != "sending":
            return False
        try:
            # The account chosen when it was scheduled; if none was recorded (older rows, or that
            # account was disconnected) the user's default Gmail account.
            accounts = await connection_service.provider_connections(session, row.user_id, "gmail")
            connection = next(
                (c for c in accounts if c.id == row.connection_id),
                accounts[0] if accounts else None,
            )
            if (
                connection is None
                or connection.status != "connected"
                or not google_gmail.has_send_scope(connection.scopes)
            ):
                raise email_service.GmailNotSendable(
                    "Gmail isn't connected with permission to send. Reconnect it on the "
                    "Integrations page."
                )
            token = await connection_service.get_valid_access_token(session, connection)
            gmail_id = await asyncio.to_thread(
                google_gmail.send_message, token, row.to_address, row.subject, row.body
            )
        except Exception as exc:
            await session.rollback()
            row = await session.get(ScheduledEmail, row_id, populate_existing=True)
            if row is None:
                return False
            row.status = "failed"
            row.error = _explain(exc)
            await _update_card(session, row, _card(row, "failed", error=row.error))
            await session.commit()
            logger.warning("scheduled_email_failed", scheduled_id=str(row_id), error=row.error)
            return False

        row.status = "sent"
        row.sent_at = now
        row.gmail_message_id = gmail_id
        await _update_card(session, row, _card(row, "sent", sent_at=now.isoformat()))
        await session.commit()
        logger.info("scheduled_email_sent", scheduled_id=str(row_id), gmail_id=gmail_id)
        return True


async def run_due(now: datetime | None = None, limit: int = MAX_PER_RUN) -> dict[str, int]:
    """Called by the external pinger. Claims due rows (FOR UPDATE SKIP LOCKED, so
    overlapping pings can't double send) and sends each from its owner's Gmail."""
    now = now or datetime.now(UTC)
    maker = get_sessionmaker()
    async with maker() as session:
        stale = await _fail_stale(session, now)
        result = await session.execute(
            select(ScheduledEmail)
            .where(ScheduledEmail.status == "scheduled", ScheduledEmail.send_at <= now)
            .order_by(ScheduledEmail.send_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        rows = list(result.scalars())
        for row in rows:
            row.status = "sending"
            row.claimed_at = now
            row.attempts += 1
        ids = [row.id for row in rows]
        await session.commit()

    sent = 0
    for row_id in ids:
        if await _deliver(maker, row_id, now):
            sent += 1
    return {"claimed": len(ids), "sent": sent, "failed": len(ids) - sent, "stale_failed": stale}
