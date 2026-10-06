"""Global search for the dashboard's Ctrl+K palette — the user's own sheets, documents and
chats. Read-only, scoped to `user_id` in every query, and free (no credits).

Matching is a case-insensitive substring match (ILIKE) with every word required, so
"sales q3" finds "Q3 sales". The pg_trgm GIN indexes (migration m3c9e5f18b62) make that
fast on big chat histories, but the queries are correct without them."""

import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.db.models.chat import ChatConversation, ChatMessage
from app.db.models.data_source import DataSource
from app.db.models.document import Document

MIN_QUERY = 2
MAX_QUERY = 80
MAX_WORDS = 5
PER_GROUP = 5
SNIPPET_CHARS = 140


@dataclass
class SheetHit:
    id: uuid.UUID
    name: str
    tab_title: str
    row_count: int


@dataclass
class DocumentHit:
    id: uuid.UUID
    filename: str
    template: str
    status: str
    row_count: int


@dataclass
class ChatHit:
    id: uuid.UUID
    title: str
    snippet: str | None  # set when the match is inside a message rather than the title
    updated_at: datetime


@dataclass
class SearchResults:
    query: str
    sheets: list[SheetHit]
    documents: list[DocumentHit]
    chats: list[ChatHit]


def parse_query(raw: str | None) -> list[str]:
    """Lower-cased words to search for; empty when the query is too short to be useful."""
    text = (raw or "").strip()[:MAX_QUERY]
    if len(text) < MIN_QUERY:
        return []
    return text.lower().split()[:MAX_WORDS]


def like_pattern(word: str) -> str:
    """`%word%` with LIKE's own wildcards escaped (escape char is a backslash)."""
    escaped = word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def make_snippet(text: str, words: list[str]) -> str:
    """A short window of `text` around the first matching word, whitespace collapsed."""
    flat = re.sub(r"\s+", " ", text).strip()
    lower = flat.lower()
    positions = [p for p in (lower.find(w) for w in words) if p >= 0]
    start = max(0, min(positions) - SNIPPET_CHARS // 3) if positions else 0
    window = flat[start : start + SNIPPET_CHARS].strip()
    return ("…" if start > 0 else "") + window + ("…" if start + SNIPPET_CHARS < len(flat) else "")


async def search(db: AsyncSession, user_id: uuid.UUID, raw_query: str | None) -> SearchResults:
    words = parse_query(raw_query)
    query = " ".join(words)
    if not words:
        return SearchResults(query=query, sheets=[], documents=[], chats=[])
    patterns = [like_pattern(w) for w in words]

    def every_word(*columns: Any) -> ColumnElement[bool]:
        # Each word must appear in at least one of the columns.
        return and_(*[or_(*[c.ilike(p, escape="\\") for c in columns]) for p in patterns])

    sheet_rows = await db.execute(
        select(DataSource)
        .where(DataSource.user_id == user_id, every_word(DataSource.name, DataSource.tab_title))
        .order_by(DataSource.updated_at.desc())
        .limit(PER_GROUP)
    )
    sheets = [
        SheetHit(id=s.id, name=s.name, tab_title=s.tab_title, row_count=s.row_count)
        for s in sheet_rows.scalars()
    ]

    doc_rows = await db.execute(
        select(Document)
        .where(Document.user_id == user_id, every_word(Document.filename, Document.template))
        .order_by(Document.created_at.desc())
        .limit(PER_GROUP)
    )
    documents = [
        DocumentHit(
            id=d.id,
            filename=d.filename,
            template=d.template,
            status=d.status,
            row_count=d.row_count,
        )
        for d in doc_rows.scalars()
    ]

    # Chats: title matches first, then chats where a message matches (title wins when both).
    title_rows = await db.execute(
        select(ChatConversation)
        .where(ChatConversation.user_id == user_id, every_word(ChatConversation.title))
        .order_by(ChatConversation.updated_at.desc())
        .limit(PER_GROUP)
    )
    chats = [
        ChatHit(id=c.id, title=c.title, snippet=None, updated_at=c.updated_at)
        for c in title_rows.scalars()
    ]
    if len(chats) < PER_GROUP:
        seen = {c.id for c in chats}
        msg_rows = await db.execute(
            select(ChatConversation, ChatMessage.content)
            .join(ChatMessage, ChatMessage.conversation_id == ChatConversation.id)
            .where(ChatConversation.user_id == user_id, every_word(ChatMessage.content))
            .order_by(ChatMessage.created_at.desc())
            .limit(PER_GROUP * 6)  # a chat can match in many messages; keep the newest per chat
        )
        for conv, content in msg_rows.all():
            if conv.id in seen:
                continue
            seen.add(conv.id)
            chats.append(
                ChatHit(
                    id=conv.id,
                    title=conv.title,
                    snippet=make_snippet(content, words),
                    updated_at=conv.updated_at,
                )
            )
            if len(chats) >= PER_GROUP:
                break

    return SearchResults(query=query, sheets=sheets, documents=documents, chats=chats)
