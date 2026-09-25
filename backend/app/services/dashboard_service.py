"""Dashboard summary — read-only counts and a recent-activity feed, derived from
tables that already exist (connections, data_sources, chat_*). There is no
separate activity-log table: every event here is a row's own `created_at`."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat import ChatConversation, ChatMessage
from app.db.models.connection import Connection
from app.db.models.data_source import DataSource

ACTIVITY_LIMIT = 8


@dataclass
class Stats:
    active_integrations: int
    connected_sheets: int
    connected_tabs: int
    questions_asked: int


@dataclass
class ActivityEvent:
    kind: str  # connection | source | chat
    title: str
    detail: str | None
    at: datetime


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
    return Stats(
        active_integrations=integrations,
        connected_sheets=sheets,
        connected_tabs=tabs,
        questions_asked=questions,
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
        events.append(
            ActivityEvent(
                "connection", "Connected Google Sheets", c.external_account_email, c.created_at
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
