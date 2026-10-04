"""Scheduled AI reports (no FastAPI imports).

An automation asks a saved question on a schedule, exactly like a chat question
(`insights_service.stream_answer` over a real conversation), and drafts the result for
the channels the user chose. It never delivers anything itself: the run waits as
`awaiting_approval` until the user clicks Send / Post / Save on the draft, which goes
through the same approval-gated paths as AI Insights.

The trigger is the existing once-a-minute external pinger (`/internal/email/run-due`
also calls `run_due` here). Runs execute in-process in background tasks; a restart can
kill one, so a run stuck `running` for STALE_AFTER is marked failed, never retried
(retrying could double-charge or double-draft). Schedules are in IST (fixed +05:30,
no DST), like the email scheduler.
"""

import asyncio
import json
import re
import uuid
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, NotFoundError
from app.db.models.automation import Automation, AutomationRun
from app.db.models.chat import ChatMessage
from app.db.models.user import User
from app.db.session import get_sessionmaker
from app.services import chat_service, credit_service, insights_service
from app.services.connection_service import get_or_create_user

logger = structlog.get_logger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))
MAX_AUTOMATIONS = 10
MAX_PER_TICK = 5
STALE_AFTER = timedelta(minutes=10)
FREQUENCIES = ("daily", "weekly", "monthly")
CHANNELS = ("email", "slack", "notion")
_EMAIL_RE = re.compile(r"^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$")

# Strong references so background runs aren't garbage-collected mid-flight.
_background: set[asyncio.Task[None]] = set()


class AutomationInvalid(AppError):
    status_code = 400
    code = "automation_invalid"


class TooManyAutomations(AppError):
    status_code = 400
    code = "too_many_automations"


class RunNotPending(AppError):
    status_code = 409
    code = "run_not_pending"


# ---------------------------------------------------------------- schedule


def next_run_after(
    now: datetime,
    frequency: str,
    hour: int,
    minute: int,
    weekday: int | None = None,
    month_day: int | None = None,
) -> datetime:
    """The next fire time (UTC) strictly after `now` for an IST schedule."""
    local = now.astimezone(IST)
    at = local.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if frequency == "daily":
        candidate = at if at > local else at + timedelta(days=1)
    elif frequency == "weekly":
        assert weekday is not None
        candidate = at + timedelta(days=(weekday - at.weekday()) % 7)
        if candidate <= local:
            candidate += timedelta(days=7)
    else:  # monthly, day 1..28 so every month has it
        assert month_day is not None
        candidate = at.replace(day=month_day)
        if candidate <= local:
            year, month = (at.year + 1, 1) if at.month == 12 else (at.year, at.month + 1)
            candidate = candidate.replace(year=year, month=month)
    return candidate.astimezone(UTC)


def upcoming(a: Automation, count: int = 3, now: datetime | None = None) -> list[datetime]:
    out: list[datetime] = []
    cursor = now or datetime.now(UTC)
    for _ in range(count):
        cursor = next_run_after(cursor, a.frequency, a.hour, a.minute, a.weekday, a.month_day)
        out.append(cursor)
    return out


def describe_schedule(
    frequency: str, hour: int, minute: int, weekday: int | None, month_day: int | None
) -> str:
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    clock = datetime(2000, 1, 1, hour, minute).strftime("%I:%M %p").lstrip("0")
    if frequency == "daily":
        return f"Every day at {clock} IST"
    if frequency == "weekly" and weekday is not None:
        return f"Every {days[weekday]} at {clock} IST"
    return f"On day {month_day} of every month at {clock} IST"


# -------------------------------------------------------------- validation


def clean_fields(data: dict[str, Any]) -> dict[str, Any]:
    """Validates and normalises user input; raises AutomationInvalid."""
    name = " ".join(str(data.get("name", "")).split())
    question = str(data.get("question", "")).strip()
    if not 1 <= len(name) <= 80:
        raise AutomationInvalid("Give the automation a name (up to 80 characters).")
    if not 3 <= len(question) <= 1000:
        raise AutomationInvalid("Write the question to ask (3 to 1000 characters).")
    ids = list(dict.fromkeys(str(i) for i in data.get("data_source_ids", [])))
    if not 1 <= len(ids) <= insights_service.MAX_SOURCES_PER_CHAT:
        raise AutomationInvalid("Choose 1 to 5 sheets or documents to ask about.")
    try:
        for i in ids:
            uuid.UUID(i)
    except ValueError as exc:
        raise AutomationInvalid("One of the chosen sheets isn't valid.") from exc

    delivery_in = data.get("delivery") or {}
    email_to = str(delivery_in.get("email") or "").strip()
    if email_to and not _EMAIL_RE.match(email_to):
        raise AutomationInvalid("Enter one valid email address to send the report to.")
    delivery = {
        "email": email_to or None,
        "slack": bool(delivery_in.get("slack")),
        "notion": bool(delivery_in.get("notion")),
    }

    frequency = str(data.get("frequency", ""))
    if frequency not in FREQUENCIES:
        raise AutomationInvalid("Choose daily, weekly or monthly.")
    hour, minute = int(data.get("hour", 9)), int(data.get("minute", 0))
    if not (0 <= hour <= 23 and minute in range(0, 60, 5)):
        raise AutomationInvalid("Pick a time on a 5-minute step.")
    weekday = data.get("weekday")
    month_day = data.get("month_day")
    if frequency == "weekly" and weekday not in range(7):
        raise AutomationInvalid("Pick the day of the week.")
    if frequency == "monthly" and month_day not in range(1, 29):
        raise AutomationInvalid("Pick a day of the month from 1 to 28.")

    gmail_id = data.get("gmail_connection_id")
    try:
        gmail_uuid = uuid.UUID(str(gmail_id)) if gmail_id else None
    except ValueError as exc:
        raise AutomationInvalid("That Gmail account isn't valid.") from exc
    return {
        "name": name,
        "question": question,
        "data_source_ids": ids,
        "gmail_connection_id": gmail_uuid,
        "delivery": delivery,
        "frequency": frequency,
        "weekday": weekday if frequency == "weekly" else None,
        "month_day": month_day if frequency == "monthly" else None,
        "hour": hour,
        "minute": minute,
    }


def build_prompt(a: Automation) -> str:
    """The saved question plus drafting instructions for each chosen channel. The agent only
    ever DRAFTS; if a channel isn't available (not connected) its tool simply isn't offered."""
    parts = [a.question.strip()]
    d = a.delivery or {}
    asks = []
    if d.get("email"):
        asks.append(f"an email to {d['email']} (draft_email)")
    if d.get("slack"):
        asks.append("a Slack message (draft_slack_message)")
    if d.get("notion"):
        asks.append("a Notion report page (draft_notion_page)")
    if asks:
        parts.append(
            "Once you have the answer, also prepare drafts of the result: "
            + ", ".join(asks)
            + ". Only draft; do not say anything was sent."
        )
    return "\n\n".join(parts)


# -------------------------------------------------------------------- CRUD


async def _owned(session: AsyncSession, clerk_user_id: str, automation_id: uuid.UUID) -> Automation:
    user = await get_or_create_user(session, clerk_user_id)
    row = (
        await session.execute(
            select(Automation).where(Automation.id == automation_id, Automation.user_id == user.id)
        )
    ).scalar_one_or_none()
    if row is None:
        raise NotFoundError("Automation not found")
    return row


def _schedule_next(a: Automation, now: datetime | None = None) -> None:
    a.next_run_at = next_run_after(
        now or datetime.now(UTC), a.frequency, a.hour, a.minute, a.weekday, a.month_day
    )


async def list_automations(session: AsyncSession, clerk_user_id: str) -> list[Automation]:
    user = await get_or_create_user(session, clerk_user_id)
    result = await session.execute(
        select(Automation).where(Automation.user_id == user.id).order_by(Automation.created_at)
    )
    return list(result.scalars())


async def create_automation(
    session: AsyncSession, clerk_user_id: str, data: dict[str, Any]
) -> Automation:
    fields = clean_fields(data)
    user = await get_or_create_user(session, clerk_user_id)
    count = await session.scalar(
        select(func.count()).select_from(Automation).where(Automation.user_id == user.id)
    )
    if (count or 0) >= MAX_AUTOMATIONS:
        raise TooManyAutomations(f"You can have up to {MAX_AUTOMATIONS} automations.")
    row = Automation(user_id=user.id, **fields)
    _schedule_next(row)
    session.add(row)
    await session.commit()
    return row


async def update_automation(
    session: AsyncSession, clerk_user_id: str, automation_id: uuid.UUID, data: dict[str, Any]
) -> Automation:
    row = await _owned(session, clerk_user_id, automation_id)
    for key, value in clean_fields(data).items():
        setattr(row, key, value)
    if row.enabled:
        _schedule_next(row)
    await session.commit()
    return row


async def set_enabled(
    session: AsyncSession, clerk_user_id: str, automation_id: uuid.UUID, enabled: bool
) -> Automation:
    row = await _owned(session, clerk_user_id, automation_id)
    row.enabled = enabled
    row.next_run_at = None
    if enabled:
        _schedule_next(row)
    await session.commit()
    return row


async def delete_automation(
    session: AsyncSession, clerk_user_id: str, automation_id: uuid.UUID
) -> None:
    row = await _owned(session, clerk_user_id, automation_id)
    await session.delete(row)
    await session.commit()


# -------------------------------------------------------------------- runs


def _spawn(run_id: uuid.UUID) -> None:
    task = asyncio.create_task(_execute(run_id))
    _background.add(task)
    task.add_done_callback(_background.discard)


async def start_manual_run(
    session: AsyncSession, clerk_user_id: str, automation_id: uuid.UUID
) -> AutomationRun:
    """ "Run now": costs the same as a scheduled run, still ends at the approval step."""
    row = await _owned(session, clerk_user_id, automation_id)
    await credit_service.require_credits(session, clerk_user_id, credit_service.QUESTION_COST)
    running = await session.scalar(
        select(func.count())
        .select_from(AutomationRun)
        .where(AutomationRun.automation_id == row.id, AutomationRun.status == "running")
    )
    if running:
        raise RunNotPending("This automation is already running.")
    run = AutomationRun(automation_id=row.id, user_id=row.user_id, trigger="manual")
    session.add(run)
    await session.commit()
    _spawn(run.id)
    return run


def _final_event_error(chunk: str) -> str | None:
    if not chunk.startswith("event: error"):
        return None
    try:
        return str(json.loads(chunk.split("data: ", 1)[1])["message"])
    except (IndexError, KeyError, ValueError):
        return "The run failed."


def drafts_of(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for s in steps or []:
        draft = s.get("draft")
        if draft:
            out.append({"step_id": s.get("id"), "draft": draft})
    return out


def _is_pending(draft: dict[str, Any]) -> bool:
    return draft.get("status") in (None, "draft", "failed")


async def _execute(run_id: uuid.UUID) -> None:
    """Runs one automation in its own session. Never raises."""
    outcome: tuple[str, str | None, str | None, uuid.UUID | None] = ("failed", None, None, None)
    try:
        async with get_sessionmaker()() as session:
            run = await session.get(AutomationRun, run_id)
            if run is None:
                return
            a = await session.get(Automation, run.automation_id)
            user = await session.get(User, run.user_id)
            if a is None or user is None:
                return
            clerk = user.clerk_user_id
            conversation_id: uuid.UUID | None = None
            try:
                await credit_service.require_credits(session, clerk, credit_service.QUESTION_COST)
                ids = [uuid.UUID(i) for i in a.data_source_ids]
                use_gmail = bool((a.delivery or {}).get("email"))
                ctx = await insights_service.load_sheet_context(
                    session, clerk, ids, use_gmail, a.gmail_connection_id
                )
                prompt = build_prompt(a)
                conversation = await chat_service.create_conversation(
                    session, clerk, a.name, ids, use_gmail, a.gmail_connection_id
                )
                conversation_id = conversation.id
                await chat_service.add_message(session, conversation_id, "user", prompt)
                run.conversation_id = conversation_id
                await session.commit()
                error: str | None = None
                async for chunk in insights_service.stream_answer(
                    ctx, prompt, [], conversation_id, conversation.title, clerk
                ):
                    error = _final_event_error(chunk) or error
                if error:
                    outcome = ("failed", None, error, conversation_id)
                else:
                    message = (
                        await session.execute(
                            select(ChatMessage)
                            .where(
                                ChatMessage.conversation_id == conversation_id,
                                ChatMessage.role == "assistant",
                            )
                            .order_by(ChatMessage.created_at.desc())
                            .limit(1)
                        )
                    ).scalar_one_or_none()
                    steps = list(message.steps or []) if message else []
                    pending = any(_is_pending(d["draft"]) for d in drafts_of(steps))
                    summary = (message.content if message else "").strip()[:400] or None
                    outcome = (
                        "awaiting_approval" if pending else "completed",
                        summary,
                        None,
                        conversation_id,
                    )
            except AppError as exc:
                outcome = ("failed", None, exc.message, conversation_id)
    except Exception:
        logger.exception("automation_run_failed", run_id=str(run_id))
        outcome = ("failed", None, "Something went wrong. Try running it again.", None)

    status, summary, error, conversation_id = outcome
    try:
        async with get_sessionmaker()() as session:
            run = await session.get(AutomationRun, run_id)
            if run is not None:
                run.status, run.summary, run.error = status, summary, error
                run.conversation_id = conversation_id or run.conversation_id
                run.finished_at = datetime.now(UTC)
                a = await session.get(Automation, run.automation_id)
                if a is not None:
                    a.last_run_at = run.finished_at
                await session.commit()
    except Exception:
        logger.exception("automation_run_finish_failed", run_id=str(run_id))


async def run_due() -> dict[str, int]:
    """Starts every enabled automation whose time has come. Safe to call every minute and to
    overlap: due rows are claimed with SKIP LOCKED and their next time is advanced before the
    run starts, so a slow run can't be started twice."""
    now = datetime.now(UTC)
    started = 0
    async with get_sessionmaker()() as session:
        stale = (
            (
                await session.execute(
                    select(AutomationRun).where(
                        AutomationRun.status == "running",
                        AutomationRun.started_at < now - STALE_AFTER,
                    )
                )
            )
            .scalars()
            .all()
        )
        for run in stale:
            run.status, run.error, run.finished_at = (
                "failed",
                "The run was interrupted. Run it again.",
                now,
            )
        due = (
            (
                await session.execute(
                    select(Automation)
                    .where(Automation.enabled.is_(True), Automation.next_run_at <= now)
                    .order_by(Automation.next_run_at)
                    .limit(MAX_PER_TICK)
                    .with_for_update(skip_locked=True)
                )
            )
            .scalars()
            .all()
        )
        run_ids = []
        for a in due:
            _schedule_next(a, now)
            run = AutomationRun(automation_id=a.id, user_id=a.user_id, trigger="schedule")
            session.add(run)
            await session.flush()
            run_ids.append(run.id)
        await session.commit()
    for rid in run_ids:
        _spawn(rid)
        started += 1
    return {"started": started, "stale_failed": len(stale)}


# ------------------------------------------------------------ inbox / history


async def list_runs(
    session: AsyncSession,
    clerk_user_id: str,
    automation_id: uuid.UUID | None = None,
    limit: int = 30,
) -> list[tuple[AutomationRun, list[dict[str, Any]]]]:
    """Recent runs, newest first, each with its drafts. A run waiting for approval flips to
    `completed` once none of its drafts is still pending (sent, posted, saved or discarded
    elsewhere), so the inbox empties itself."""
    user = await get_or_create_user(session, clerk_user_id)
    query = select(AutomationRun).where(AutomationRun.user_id == user.id)
    if automation_id:
        query = query.where(AutomationRun.automation_id == automation_id)
    runs = list(
        (await session.execute(query.order_by(AutomationRun.started_at.desc()).limit(limit)))
        .scalars()
        .all()
    )
    out: list[tuple[AutomationRun, list[dict[str, Any]]]] = []
    changed = False
    for run in runs:
        drafts: list[dict[str, Any]] = []
        if run.conversation_id and run.status in ("awaiting_approval", "completed"):
            message = (
                await session.execute(
                    select(ChatMessage)
                    .where(
                        ChatMessage.conversation_id == run.conversation_id,
                        ChatMessage.role == "assistant",
                    )
                    .order_by(ChatMessage.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            drafts = drafts_of(list(message.steps or [])) if message else []
            if run.status == "awaiting_approval" and not any(
                _is_pending(d["draft"]) for d in drafts
            ):
                run.status = "completed"
                changed = True
        out.append((run, drafts))
    if changed:
        await session.commit()
    return out


async def dismiss_run(session: AsyncSession, clerk_user_id: str, run_id: uuid.UUID) -> None:
    """ "Skip": the user doesn't want this report delivered. Nothing is sent."""
    user = await get_or_create_user(session, clerk_user_id)
    run = (
        await session.execute(
            select(AutomationRun).where(
                AutomationRun.id == run_id, AutomationRun.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if run is None:
        raise NotFoundError("Run not found")
    if run.status != "awaiting_approval":
        raise RunNotPending("This report isn't waiting for approval.")
    run.status = "dismissed"
    await session.commit()
