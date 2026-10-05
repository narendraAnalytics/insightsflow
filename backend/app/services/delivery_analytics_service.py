"""Analytics for what the user sends to Slack and saves to Notion, derived from the
approval drafts that already live in `chat_messages.steps[].draft` (kind "slack" |
"notion", status draft | sent | failed) plus the `connections` rows. There is no
delivery table: a draft's own `sent_at` is the event, and the message's `created_at`
is when the agent drafted it. Days are IST calendar days, like the rest of Analytics.

Only drafts from messages created inside the current + previous window are read, so a
draft written before the previous window and approved inside this one is not counted
(approvals are normally immediate, so this is a rounding error, not a trend).

`summarise` is pure (rows in, dataclasses out) and unit-tested; `get_delivery` does the I/O.
"""

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import Text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat import ChatConversation, ChatMessage
from app.db.models.connection import Connection
from app.services import connection_service
from app.services.analytics_service import normalise_range, pct_change, window_days
from app.services.dashboard_service import IST

PROVIDERS = ("slack", "notion")
TOP_DESTINATIONS = 8
RECENT_LIMIT = 8
PREVIEW_CHARS = 90


@dataclass
class Kpi:
    key: str
    value: int
    previous: int
    change_pct: float | None


@dataclass
class DayPoint:
    date: str
    drafted: int
    sent: int


@dataclass
class Count:
    label: str
    value: int


@dataclass
class SentItem:
    preview: str
    destination: str
    workspace: str
    sent_at: str
    url: str | None
    conversation_id: uuid.UUID


@dataclass
class Workspace:
    name: str
    destination: str | None  # default Slack channel / Notion parent page
    is_default: bool


@dataclass
class ProviderStats:
    connected: bool
    workspaces: list[Workspace]
    kpis: list[Kpi]
    approval_rate: float | None  # sent / drafted in the window, in percent
    waiting: int  # drafts still waiting for the user's approval (or failed)
    daily: list[DayPoint]
    by_destination: list[Count]
    by_workspace: list[Count]
    recent: list[SentItem] = field(default_factory=list)


@dataclass
class DraftRow:
    created_at: datetime  # when the agent drafted it
    conversation_id: uuid.UUID
    draft: dict[str, Any]


def _ist_date(value: datetime | str | None) -> date | None:
    if value is None:
        return None
    try:
        moment = value if isinstance(value, datetime) else datetime.fromisoformat(value)
    except ValueError:
        return None
    return moment.astimezone(IST).date() if moment.tzinfo else moment.date()


def _destination(kind: str, draft: dict[str, Any]) -> str:
    if kind == "slack":
        name = str(draft.get("channel_name") or "")
        return f"#{name}" if name else "Slack"
    return str(draft.get("page_title") or "Notion")


def _preview(kind: str, draft: dict[str, Any]) -> str:
    text = str(draft.get("title") if kind == "notion" else draft.get("text") or "").strip()
    text = " ".join(text.split())
    return text if len(text) <= PREVIEW_CHARS else text[: PREVIEW_CHARS - 1] + "…"


def _ratio(sent: int, drafted: int) -> float | None:
    return round(sent / drafted * 100, 1) if drafted else None


def summarise(
    kind: str,
    rows: list[DraftRow],
    today: date,
    days: int,
    connections: list[Workspace],
) -> ProviderStats:
    current = window_days(today, days)
    previous = window_days(current[0] - timedelta(days=1), days)
    cur_set, prev_set = set(current), set(previous)

    drafted_cur = drafted_prev = sent_cur = sent_prev = waiting = 0
    drafted_by_day: dict[date, int] = {}
    sent_by_day: dict[date, int] = {}
    destinations: dict[str, int] = {}
    workspaces: dict[str, int] = {}
    sent_items: list[tuple[str, SentItem]] = []
    sent_of_drafted_cur = 0

    for row in rows:
        if row.draft.get("kind") != kind:
            continue
        made = _ist_date(row.created_at)
        status = row.draft.get("status")
        if made in cur_set:
            drafted_cur += 1
            drafted_by_day[made] = drafted_by_day.get(made, 0) + 1
            if status == "sent":
                sent_of_drafted_cur += 1
            elif status in (None, "draft", "failed"):
                waiting += 1
        elif made in prev_set:
            drafted_prev += 1

        if status != "sent":
            continue
        sent_on = _ist_date(row.draft.get("sent_at"))
        if sent_on in prev_set:
            sent_prev += 1
        if sent_on not in cur_set or sent_on is None:
            continue
        sent_cur += 1
        sent_by_day[sent_on] = sent_by_day.get(sent_on, 0) + 1
        dest = _destination(kind, row.draft)
        destinations[dest] = destinations.get(dest, 0) + 1
        ws = str(row.draft.get("workspace") or "Unknown workspace")
        workspaces[ws] = workspaces.get(ws, 0) + 1
        sent_items.append(
            (
                str(row.draft.get("sent_at")),
                SentItem(
                    preview=_preview(kind, row.draft),
                    destination=dest,
                    workspace=ws,
                    sent_at=str(row.draft.get("sent_at")),
                    url=row.draft.get("url") if kind == "notion" else None,
                    conversation_id=row.conversation_id,
                ),
            )
        )

    def top(counts: dict[str, int]) -> list[Count]:
        ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        return [Count(k, v) for k, v in ranked[:TOP_DESTINATIONS]]

    sent_items.sort(key=lambda pair: pair[0], reverse=True)
    return ProviderStats(
        connected=bool(connections),
        workspaces=connections,
        kpis=[
            Kpi("sent", sent_cur, sent_prev, pct_change(sent_cur, sent_prev)),
            Kpi("drafted", drafted_cur, drafted_prev, pct_change(drafted_cur, drafted_prev)),
        ],
        approval_rate=_ratio(sent_of_drafted_cur, drafted_cur),
        waiting=waiting,
        daily=[DayPoint(str(d), drafted_by_day.get(d, 0), sent_by_day.get(d, 0)) for d in current],
        by_destination=top(destinations),
        by_workspace=top(workspaces),
        recent=[item for _, item in sent_items[:RECENT_LIMIT]],
    )


def _workspaces(connections: list[Connection]) -> dict[str, list[Workspace]]:
    out: dict[str, list[Workspace]] = {p: [] for p in PROVIDERS}
    for c in connections:
        if c.provider not in out or c.status != "connected":
            continue
        cfg = c.config or {}
        destination = cfg.get("channel_name") if c.provider == "slack" else cfg.get("page_title")
        if c.provider == "slack" and destination:
            destination = f"#{destination}"
        out[c.provider].append(
            Workspace(
                name=c.external_account_email or "Workspace",
                destination=destination or None,
                is_default=connection_service.is_default(c),
            )
        )
    return out


async def get_delivery(
    db: AsyncSession, user_id: uuid.UUID, days: int
) -> tuple[int, dict[str, ProviderStats]]:
    days = normalise_range(days)
    today = datetime.now(IST).date()
    current = window_days(today, days)
    since = datetime.combine(
        window_days(current[0] - timedelta(days=1), days)[0], time.min, tzinfo=IST
    )

    messages = (
        await db.execute(
            select(ChatMessage.created_at, ChatMessage.conversation_id, ChatMessage.steps)
            .join(ChatConversation, ChatConversation.id == ChatMessage.conversation_id)
            .where(
                ChatConversation.user_id == user_id,
                ChatMessage.role == "assistant",
                ChatMessage.created_at >= since,
                ChatMessage.steps.cast(Text).like('%"draft"%'),
            )
        )
    ).all()
    rows = [
        DraftRow(created, conv, step["draft"])
        for created, conv, steps in messages
        for step in (steps or [])
        if isinstance(step, dict) and isinstance(step.get("draft"), dict)
    ]
    connections = list(
        (await db.execute(select(Connection).where(Connection.user_id == user_id))).scalars()
    )
    workspaces = _workspaces(connections)
    return days, {p: summarise(p, rows, today, days, workspaces[p]) for p in PROVIDERS}
