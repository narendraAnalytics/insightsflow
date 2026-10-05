"""Analytics of the user's OWN InsightFlow usage — questions asked, credits spent,
automation runs, scheduled mail — over a chosen window, compared with the window
right before it. Everything is derived from existing tables (chat_messages,
credit_ledger, automation_runs, scheduled_emails, data_sources); there is no
analytics table. Days are IST calendar days, like the dashboard chart.

Not here yet (later slices): numbers computed from the connected sheets, and
Slack / Notion delivery counts.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.automation import Automation, AutomationRun
from app.db.models.billing import CreditLedger
from app.db.models.chat import ChatConversation, ChatMessage
from app.db.models.data_source import DataSource
from app.db.models.scheduled_email import ScheduledEmail
from app.services.dashboard_service import IST, _ist_day

ALLOWED_RANGES = (7, 30, 90)
DEFAULT_RANGE = 30
RECENT_RUNS_LIMIT = 5
TOP_SOURCES_LIMIT = 5


@dataclass
class Kpi:
    key: str
    value: int
    previous: int
    change_pct: float | None  # None when there is no previous value to compare against


@dataclass
class DayPoint:
    date: str
    questions: int
    credits: int


@dataclass
class Spend:
    reason: str
    credits: int


@dataclass
class RunStats:
    total: int
    by_status: dict[str, int]
    success_rate: float | None  # share of runs that did not fail; None with no runs


@dataclass
class RecentRun:
    id: uuid.UUID
    automation: str
    status: str
    trigger: str
    started_at: datetime
    conversation_id: uuid.UUID | None


@dataclass
class SourceRow:
    name: str
    tab_title: str
    row_count: int


@dataclass
class Analytics:
    range_days: int
    start: str
    end: str
    kpis: list[Kpi]
    daily: list[DayPoint]
    spend_by_reason: list[Spend]
    runs: RunStats
    recent_runs: list[RecentRun]
    sources: list[SourceRow]


def normalise_range(days: int | None) -> int:
    """Only the ranges the UI offers are accepted; anything else falls back to the default."""
    return days if days in ALLOWED_RANGES else DEFAULT_RANGE


def window_days(today: date, days: int) -> list[date]:
    """The `days` IST dates ending today, oldest first."""
    return [today - timedelta(days=days - 1 - i) for i in range(days)]


def pct_change(current: int, previous: int) -> float | None:
    """Percent change vs the previous window. None when there is nothing to compare to
    (a jump from 0 has no meaningful percentage — the UI shows "new" instead)."""
    if previous <= 0:
        return None
    return round((current - previous) / previous * 100, 1)


def success_rate(by_status: dict[str, int]) -> float | None:
    total = sum(by_status.values())
    if total == 0:
        return None
    return round((total - by_status.get("failed", 0)) / total * 100, 1)


async def _by_day(db: AsyncSession, stmt: Select[Any]) -> dict[str, int]:
    return {str(day): int(n or 0) for day, n in (await db.execute(stmt)).all()}


def _sum(by_day: dict[str, int], days: list[date]) -> int:
    return sum(by_day.get(str(d), 0) for d in days)


async def get_analytics(db: AsyncSession, user_id: uuid.UUID, days: int) -> Analytics:
    days = normalise_range(days)
    today = datetime.now(IST).date()
    current = window_days(today, days)
    previous = window_days(current[0] - timedelta(days=1), days)
    since = datetime.combine(previous[0], time.min, tzinfo=IST)  # covers both windows
    current_since = datetime.combine(current[0], time.min, tzinfo=IST)

    questions = await _by_day(
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
    credits = await _by_day(
        db,
        select(_ist_day(CreditLedger.created_at), -func.sum(CreditLedger.delta))
        .where(
            CreditLedger.user_id == user_id,
            CreditLedger.delta < 0,
            CreditLedger.created_at >= since,
        )
        .group_by(_ist_day(CreditLedger.created_at)),
    )
    runs_by_day = await _by_day(
        db,
        select(_ist_day(AutomationRun.started_at), func.count())
        .where(AutomationRun.user_id == user_id, AutomationRun.started_at >= since)
        .group_by(_ist_day(AutomationRun.started_at)),
    )
    mail_by_day = await _by_day(
        db,
        select(_ist_day(ScheduledEmail.sent_at), func.count())
        .where(
            ScheduledEmail.user_id == user_id,
            ScheduledEmail.status == "sent",
            ScheduledEmail.sent_at >= since,
        )
        .group_by(_ist_day(ScheduledEmail.sent_at)),
    )

    def kpi(key: str, by_day: dict[str, int]) -> Kpi:
        cur, prev = _sum(by_day, current), _sum(by_day, previous)
        return Kpi(key, cur, prev, pct_change(cur, prev))

    kpis = [
        kpi("questions", questions),
        kpi("credits_spent", credits),
        kpi("automation_runs", runs_by_day),
        kpi("scheduled_emails", mail_by_day),
    ]
    daily = [
        DayPoint(str(d), questions.get(str(d), 0), credits.get(str(d), 0)) for d in current
    ]

    spend_rows = (
        await db.execute(
            select(CreditLedger.reason, -func.sum(CreditLedger.delta))
            .where(
                CreditLedger.user_id == user_id,
                CreditLedger.delta < 0,
                CreditLedger.created_at >= current_since,
            )
            .group_by(CreditLedger.reason)
            .order_by(-func.sum(CreditLedger.delta).desc())
        )
    ).all()
    spend = [Spend(reason, int(n)) for reason, n in spend_rows]

    status_rows = (
        await db.execute(
            select(AutomationRun.status, func.count())
            .where(AutomationRun.user_id == user_id, AutomationRun.started_at >= current_since)
            .group_by(AutomationRun.status)
        )
    ).all()
    by_status = {status: int(n) for status, n in status_rows}
    runs = RunStats(sum(by_status.values()), by_status, success_rate(by_status))

    recent = (
        await db.execute(
            select(AutomationRun, Automation.name)
            .join(Automation, Automation.id == AutomationRun.automation_id)
            .where(AutomationRun.user_id == user_id)
            .order_by(AutomationRun.started_at.desc())
            .limit(RECENT_RUNS_LIMIT)
        )
    ).all()
    recent_runs = [
        RecentRun(r.id, name, r.status, r.trigger, r.started_at, r.conversation_id)
        for r, name in recent
    ]

    source_rows = (
        await db.execute(
            select(DataSource)
            .where(DataSource.user_id == user_id)
            .order_by(DataSource.row_count.desc())
            .limit(TOP_SOURCES_LIMIT)
        )
    ).scalars()
    sources = [SourceRow(s.name, s.tab_title, s.row_count) for s in source_rows]

    return Analytics(
        range_days=days,
        start=str(current[0]),
        end=str(current[-1]),
        kpis=kpis,
        daily=daily,
        spend_by_reason=spend,
        runs=runs,
        recent_runs=recent_runs,
        sources=sources,
    )
