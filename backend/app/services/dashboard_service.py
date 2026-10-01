"""Dashboard summary — read-only counts and a recent-activity feed, derived from
tables that already exist (connections, data_sources, chat_*). There is no
separate activity-log table: every event here is a row's own `created_at`."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import Select, func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.db.models.chat import ChatConversation, ChatMessage
from app.db.models.connection import Connection
from app.db.models.data_source import DataSource

ACTIVITY_LIMIT = 8
DAILY_ACTIVITY_DAYS = 7

# The chart's days are Indian days, matching the rest of the product (scheduled mail is IST
# too). IST has no daylight saving, so a fixed +05:30 offset is exact.
IST = timezone(timedelta(hours=5, minutes=30))


def _ist_day(column: Any) -> ColumnElement[Any]:
    """The IST calendar date of a timestamptz column, for GROUP BY."""
    # A literal (not a bind parameter) so SELECT and GROUP BY render the identical expression.
    return func.date(func.timezone(literal_column("'Asia/Kolkata'"), column))


@dataclass
class Stats:
    active_integrations: int
    connected_sheets: int
    connected_tabs: int
    questions_asked: int
    # Which providers are connected (e.g. ["google_sheets", "gmail"]), oldest first,
    # so the UI can show their icons instead of a hardcoded label.
    connected_providers: list[str]


@dataclass
class ActivityEvent:
    kind: str  # connection | source | chat
    title: str
    detail: str | None
    at: datetime
    provider: str | None = None  # set for connection events


@dataclass
class DailyActivity:
    date: str  # YYYY-MM-DD
    connections: int
    sources: int
    chats: int


async def _count(db: AsyncSession, stmt: Select[Any]) -> int:
    return int((await db.execute(stmt)).scalar_one())


async def get_stats(db: AsyncSession, user_id: uuid.UUID) -> Stats:
    integrations = await _count(
        db,
        select(func.count())
        .select_from(Connection)
        .where(Connection.user_id == user_id, Connection.status == "connected"),
    )
    tabs = await _count(
        db, select(func.count()).select_from(DataSource).where(DataSource.user_id == user_id)
    )
    sheets = await _count(
        db,
        select(func.count(func.distinct(DataSource.external_id))).where(
            DataSource.user_id == user_id
        ),
    )
    questions = await _count(
        db,
        select(func.count())
        .select_from(ChatMessage)
        .join(ChatConversation, ChatConversation.id == ChatMessage.conversation_id)
        .where(ChatConversation.user_id == user_id, ChatMessage.role == "user"),
    )
    providers = (
        await db.execute(
            select(Connection.provider)
            .where(Connection.user_id == user_id, Connection.status == "connected")
            .order_by(Connection.created_at)
        )
    ).scalars()
    return Stats(
        active_integrations=integrations,
        connected_sheets=sheets,
        connected_tabs=tabs,
        questions_asked=questions,
        connected_providers=list(dict.fromkeys(providers)),
    )


async def list_sources(db: AsyncSession, user_id: uuid.UUID) -> list[DataSource]:
    rows = await db.execute(
        select(DataSource)
        .where(DataSource.user_id == user_id)
        .order_by(DataSource.updated_at.desc())
        .limit(10)
    )
    return list(rows.scalars())


async def recent_activity(db: AsyncSession, user_id: uuid.UUID) -> list[ActivityEvent]:
    events: list[ActivityEvent] = []

    for c in (
        await db.execute(
            select(Connection)
            .where(Connection.user_id == user_id)
            .order_by(Connection.created_at.desc())
            .limit(ACTIVITY_LIMIT)
        )
    ).scalars():
        app_name = {"gmail": "Gmail", "slack": "Slack"}.get(c.provider, "Google Sheets")
        events.append(
            ActivityEvent(
                "connection",
                f"Connected {app_name}",
                c.external_account_email,
                c.created_at,
                c.provider,
            )
        )

    for s in (
        await db.execute(
            select(DataSource)
            .where(DataSource.user_id == user_id)
            .order_by(DataSource.created_at.desc())
            .limit(ACTIVITY_LIMIT)
        )
    ).scalars():
        label = f"{s.name} — {s.tab_title}" if s.tab_title else s.name
        events.append(ActivityEvent("source", "Added a sheet", label, s.created_at))

    for chat in (
        await db.execute(
            select(ChatConversation)
            .where(ChatConversation.user_id == user_id)
            .order_by(ChatConversation.created_at.desc())
            .limit(ACTIVITY_LIMIT)
        )
    ).scalars():
        events.append(ActivityEvent("chat", "Asked AI Insights", chat.title, chat.created_at))

    events.sort(key=lambda e: e.at, reverse=True)
    return events[:ACTIVITY_LIMIT]


async def _counts_by_day(db: AsyncSession, stmt: Select[Any]) -> dict[str, int]:
    rows = await db.execute(stmt)
    return {str(day): int(count) for day, count in rows.all()}


async def daily_activity(db: AsyncSession, user_id: uuid.UUID) -> list[DailyActivity]:
    """Per day for the last DAILY_ACTIVITY_DAYS days: sources and questions CREATED that
    day (zero-filled — there's no activity-log table, so a quiet day is just an absence
    of rows, not a stored zero), and connections as a running total of what is connected."""
    today = datetime.now(IST).date()
    start_day = today - timedelta(days=DAILY_ACTIVITY_DAYS - 1)
    since = datetime.combine(start_day, time.min, tzinfo=IST)

    # Connections are a RUNNING TOTAL (how many were connected as of each day), not
    # per-day creations: a connection made 6 days ago must still count today, and one
    # made earlier than the window must not vanish from the chart. Current status is
    # used (there's no history of disconnects), so a disconnected app isn't counted.
    connected_before_window = await _count(
        db,
        select(func.count())
        .select_from(Connection)
        .where(
            Connection.user_id == user_id,
            Connection.status == "connected",
            Connection.created_at < since,
        ),
    )
    connections_created = await _counts_by_day(
        db,
        select(_ist_day(Connection.created_at), func.count())
        .where(
            Connection.user_id == user_id,
            Connection.status == "connected",
            Connection.created_at >= since,
        )
        .group_by(_ist_day(Connection.created_at)),
    )
    sources = await _counts_by_day(
        db,
        select(_ist_day(DataSource.created_at), func.count())
        .where(DataSource.user_id == user_id, DataSource.created_at >= since)
        .group_by(_ist_day(DataSource.created_at)),
    )
    chats = await _counts_by_day(
        db,
        select(_ist_day(ChatMessage.created_at), func.count())
        .select_from(ChatMessage)
        .join(ChatConversation, ChatConversation.id == ChatMessage.conversation_id)
        .where(
            ChatConversation.user_id == user_id,
            ChatMessage.role == "user",
            ChatMessage.created_at >= since,
        )
        .group_by(_ist_day(ChatMessage.created_at)),
    )

    days: list[DailyActivity] = []
    connected = connected_before_window
    for offset in range(DAILY_ACTIVITY_DAYS):
        day: date = today - timedelta(days=DAILY_ACTIVITY_DAYS - 1 - offset)
        key = str(day)
        connected += connections_created.get(key, 0)
        days.append(
            DailyActivity(
                date=key,
                connections=connected,
                sources=sources.get(key, 0),
                chats=chats.get(key, 0),
            )
        )
    return days
