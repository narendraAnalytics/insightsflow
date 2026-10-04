"""Business logic for AI Insights: load the user's sheet, run the LangGraph
agent, and translate its stream into UI-friendly events (no FastAPI imports)."""

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from dataclasses import asdict, dataclass, field
from typing import Any

import pandas as pd
import structlog
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.graph import TableInfo, TextInfo, build_graph, build_system_prompt, shared_columns
from app.agent.llm import build_llm
from app.agent.texts import TextSet
from app.agent.tools import TableSet, build_frame, build_tools, describe_schema, tool_label
from app.core.errors import AppError, NotFoundError
from app.db.session import get_sessionmaker
from app.integrations.google import gmail as google_gmail
from app.integrations.google import sheets as google_sheets
from app.services import (
    chat_service,
    connection_service,
    credit_service,
    data_source_service,
    document_service,
    notion_service,
    slack_service,
)

logger = structlog.get_logger(__name__)

MAX_SHEET_ROWS = 5000
MAX_HISTORY_TURNS = 10
REQUEST_TIMEOUT_SECONDS = 90


MAX_SOURCES_PER_CHAT = 5


class TooManySourcesInChat(AppError):
    status_code = 400
    code = "too_many_sources_in_chat"


@dataclass
class SheetContext:
    """The tables one chat can query — one per selected data source."""

    tables: dict[str, pd.DataFrame]  # table name -> data
    truncated: bool
    # Set only when the user's Gmail connection has the read scope (dev-only feature).
    gmail_token: str | None = None
    # The same connection also holds the send scope, so the agent may DRAFT emails
    # (it can never send: the user's click on the draft card does that).
    gmail_can_send: bool = False
    # The user's default Slack channel ({id, name}) when Slack is connected and one is
    # chosen: lets the agent DRAFT a post (the user's click on the card posts it).
    slack_channel: dict[str, str] | None = None
    # The user's chosen Notion parent page ({id, title}); lets the agent DRAFT a page.
    notion_page: dict[str, str] | None = None
    # Digitised text documents: name -> passages [{"page", "section", "text"}].
    texts: dict[str, list[dict[str, Any]]] = field(default_factory=dict)

    @property
    def label(self) -> str:
        names = [*self.tables, *self.texts, *(["Gmail"] if self.gmail_token else [])]
        return " + ".join(names)


@dataclass
class _NamedTable:
    """Stands in for a sheet tab when naming a table made from an uploaded document."""

    name: str
    tab_title: str = ""


def _document_name(doc: Any) -> str:
    return doc.filename.rsplit(".", 1)[0] or doc.filename


def _text_passages(docs: list[Any], taken: set[str]) -> dict[str, list[dict[str, Any]]]:
    """Name -> passages for text documents; a name that clashes gets a number."""
    out: dict[str, list[dict[str, Any]]] = {}
    for doc in docs:
        name, n = _document_name(doc), 2
        while name in out or name in taken:
            name, n = f"{_document_name(doc)} ({n})", n + 1
        out[name] = [{"page": r[0], "section": r[1], "text": r[2]} for r in doc.rows]
    return out


def _text_infos(ctx: "SheetContext") -> list[TextInfo]:
    return [TextInfo(name, len({p["page"] for p in ps}), len(ps)) for name, ps in ctx.texts.items()]


def _table_names(sources: list[Any]) -> list[str]:
    """Readable, unique table names: the tab title, or 'Book / Tab' when two
    tabs share a title."""
    names = [s.tab_title or s.name for s in sources]
    if len(set(names)) != len(names):
        names = [f"{s.name} / {s.tab_title}" if s.tab_title else s.name for s in sources]
    seen: dict[str, int] = {}
    unique = []
    for name in names:
        seen[name] = seen.get(name, 0) + 1
        unique.append(name if seen[name] == 1 else f"{name} ({seen[name]})")
    return unique


class GmailNotReadable(AppError):
    status_code = 400
    code = "gmail_not_readable"


async def load_sheet_context(
    session: AsyncSession,
    clerk_user_id: str,
    source_ids: list[uuid.UUID],
    use_gmail: bool = False,
    gmail_connection_id: uuid.UUID | None = None,
) -> SheetContext:
    """All DB + Google I/O happens here, before streaming starts, so failures
    surface as normal HTTP errors and the SSE generator never touches the session.
    A chat needs at least one sheet or Gmail; Gmail is only readable when the chat
    opted in (`use_gmail`) AND the connection has the read scope."""
    ids = list(dict.fromkeys(source_ids))  # de-duplicate, keep order
    if not ids and not use_gmail:
        raise AppError("Choose a sheet or Gmail to ask about.", code="data_source_required")
    if len(ids) > MAX_SOURCES_PER_CHAT:
        raise TooManySourcesInChat(f"A chat can use up to {MAX_SOURCES_PER_CHAT} sheets at once")

    gmail_token, can_send = None, False
    if use_gmail:
        gmail_token, can_send = await _gmail_access(session, clerk_user_id, gmail_connection_id)
        if gmail_token is None:
            raise GmailNotReadable(
                "Gmail isn't connected with permission to read email. "
                "Reconnect it on the Integrations page."
            )

    tables: dict[str, pd.DataFrame] = {}
    truncated = False
    # An id may name an uploaded document instead of a sheet tab; both feed the same
    # TableSet, so the agent's tools (and joins across them) don't care which is which.
    documents = await document_service.get_ready_documents(session, clerk_user_id, ids)
    document_ids = {d.id for d in documents}
    sheet_ids = [i for i in ids if i not in document_ids]
    named: list[Any] = []
    frames: list[pd.DataFrame] = []
    if sheet_ids:
        sources = [
            await data_source_service.get_source(session, clerk_user_id, i) for i in sheet_ids
        ]
        # One token per Google login: a chat may use sheets from several of them.
        access_tokens: dict[uuid.UUID, str] = {}
        for connection_id in dict.fromkeys(src.connection_id for src in sources):
            connection = await connection_service.get_connection(
                session, clerk_user_id, "google_sheets", connection_id
            )
            access_tokens[connection_id] = await connection_service.get_valid_access_token(
                session, connection
            )
        previews = await asyncio.gather(
            *(
                asyncio.to_thread(
                    google_sheets.fetch_sheet_preview,
                    access_tokens[src.connection_id],
                    src.external_id,
                    src.tab_title or None,
                    MAX_SHEET_ROWS,
                )
                for src in sources
            )
        )
        named += sources
        frames += [build_frame(p.headers, p.rows) for p in previews]
        truncated = any(len(f) >= MAX_SHEET_ROWS for f in frames)
    table_docs = [d for d in documents if d.kind != "text"]
    text_docs = [d for d in documents if d.kind == "text"]
    for doc in table_docs:
        named.append(_NamedTable(_document_name(doc)))
        frames.append(build_frame(list(doc.headers), [list(r) for r in doc.rows]))
    if named:
        tables = dict(zip(_table_names(named), frames, strict=True))
    texts = _text_passages(text_docs, taken=set(tables))
    return SheetContext(
        tables=tables,
        texts=texts,
        truncated=truncated,
        gmail_token=gmail_token,
        gmail_can_send=can_send,
        slack_channel=await _slack_channel(session, clerk_user_id, gmail_connection_id),
        notion_page=await _notion_page(session, clerk_user_id, gmail_connection_id),
    )


async def _notion_page(
    session: AsyncSession, clerk_user_id: str, gmail_connection_id: uuid.UUID | None = None
) -> dict[str, str] | None:
    """Never blocks Q&A: any failure just means the Notion tool isn't offered."""
    try:
        return await notion_service.default_page(session, clerk_user_id, gmail_connection_id)
    except Exception:
        logger.warning("notion_page_unavailable", exc_info=True)
        return None


async def _slack_channel(
    session: AsyncSession, clerk_user_id: str, gmail_connection_id: uuid.UUID | None = None
) -> dict[str, str] | None:
    """Never blocks Q&A: any failure just means the Slack tool isn't offered."""
    try:
        return await slack_service.default_channel(session, clerk_user_id, gmail_connection_id)
    except Exception:
        logger.warning("slack_channel_unavailable", exc_info=True)
        return None


async def _gmail_access(
    session: AsyncSession, clerk_user_id: str, connection_id: uuid.UUID | None = None
) -> tuple[str | None, bool]:
    """(access token, may-send) — the token only if the chosen Gmail account (else the default
    one) is connected WITH the read scope. Never blocks sheet Q&A: any failure (not
    connected, revoked, expired refresh token) just means the email tools aren't offered."""
    try:
        connection = await connection_service.get_connection(
            session, clerk_user_id, "gmail", connection_id
        )
        if connection.status != "connected" or not google_gmail.has_read_scope(connection.scopes):
            return None, False
        token = await connection_service.get_valid_access_token(session, connection)
        return token, google_gmail.has_send_scope(connection.scopes)
    except NotFoundError:
        return None, False
    except Exception:
        logger.warning("gmail_token_unavailable", exc_info=True)
        return None, False


def _table_infos(ctx: SheetContext) -> list[TableInfo]:
    return [TableInfo(name, len(df), describe_schema(df)) for name, df in ctx.tables.items()]


def _is_category(series: pd.Series) -> bool:
    """A text column worth grouping by: repeats values, and isn't an ID."""
    if pd.api.types.is_numeric_dtype(series):
        return False
    name = str(series.name).lower().replace("_", " ")
    if name == "id" or name.endswith(" id") or name.endswith(" no"):
        return False
    values = series.dropna()
    return len(values) > 0 and values.nunique() <= max(2, int(len(values) * 0.7))


_MEASURE_HINTS = (
    "total",
    "revenue",
    "sales",
    "amount",
    "spent",
    "price",
    "value",
    "cost",
    "profit",
)
_GROUP_HINTS = ("type", "category", "segment", "tier", "status", "region", "class", "product")


def _ranked(columns: list[str], hints: tuple[str, ...]) -> list[str]:
    """Columns whose names suggest a business meaning first, original order otherwise."""
    return sorted(
        columns, key=lambda c: next((i for i, h in enumerate(hints) if h in c.lower()), len(hints))
    )


def suggest_questions(ctx: SheetContext) -> list[str]:
    """Starter questions built from the real columns. With several tables, lead
    with a question that needs a join across a shared column."""
    email_questions = [
        "Show me my 5 most recent emails",
        "Who sent me the latest email?",
        "What are the subjects of my last 3 emails?",
    ]
    document_questions = [
        "Summarise this document in a few lines",
        "What are the key dates and amounts mentioned?",
        "What obligations does each party have?",
    ]
    if not ctx.tables:
        if ctx.texts:
            return document_questions[:3]
        return email_questions if ctx.gmail_token else []
    infos = _table_infos(ctx)

    def numbers(df: pd.DataFrame) -> list[str]:
        return _ranked(
            [str(c) for c in df.columns if pd.api.types.is_numeric_dtype(df[c])], _MEASURE_HINTS
        )

    def categories(df: pd.DataFrame, exclude: set[str]) -> list[str]:
        found = [
            str(c) for c in df.columns if str(c).lower() not in exclude and _is_category(df[c])
        ]
        return _ranked(found, _GROUP_HINTS)

    out: list[str] = []
    shared = shared_columns(infos)
    if len(infos) > 1 and shared:
        key, holders = next(iter(shared.items()))
        left_name, right_name = holders[0], holders[1]
        measure = next(iter(numbers(ctx.tables[left_name])), None)
        group = next(iter(categories(ctx.tables[right_name], {c.lower() for c in shared})), None)
        if measure and group:
            out.append(f"Which {group} has the highest {measure}?")
        out.append(f"How many {key} values match between {left_name} and {right_name}?")

    first = next(iter(ctx.tables.values()))
    out.append(
        "Give me a summary of these sheets" if len(infos) > 1 else "Give me a summary of this sheet"
    )
    nums, cats = numbers(first), categories(first, set())
    if nums:
        out.append(f"What is the sum of {nums[0]}?")
    if nums and cats:
        out.append(f"Which {cats[0]} has the highest {nums[0]}?")
    if len(nums) > 1:
        out.append(f"What is the average {nums[1]}?")
    out = list(dict.fromkeys(out))
    if ctx.gmail_token:  # a sheet chat that also has Gmail: keep one email starter
        return [*out[:3], email_questions[0]]
    return out[:4]


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def _history_messages(history: list[dict[str, str]]) -> list[BaseMessage]:
    out: list[BaseMessage] = []
    for turn in history[-MAX_HISTORY_TURNS * 2 :]:
        cls = HumanMessage if turn["role"] == "user" else AIMessage
        out.append(cls(content=turn["content"]))
    return out


def _tool_result_event(msg: ToolMessage) -> dict[str, Any]:
    try:
        payload = json.loads(str(msg.content))
    except json.JSONDecodeError:
        payload = {"summary": str(msg.content)[:200]}
    if "error" in payload:
        return {"id": msg.tool_call_id, "ok": False, "summary": payload["error"]}
    return {
        "id": msg.tool_call_id,
        "ok": True,
        "summary": payload.get("summary", ""),
        "value": payload.get("value"),
        "table": payload.get("table"),
        "headline": payload.get("headline"),
        "emails": payload.get("emails"),
        "draft": payload.get("draft"),
    }


async def _charge_question(
    clerk_user_id: str,
    conversation_id: uuid.UUID,
    cost: int = credit_service.QUESTION_COST,
    reason: str = "ai_question",
) -> None:
    """Debits the cost of one answer, only after it completed (failed runs are free).
    Own session, like _persist_assistant. /ask already checked the balance, so a
    failure here (a concurrent spend) just means this one answer went uncharged."""
    try:
        async with get_sessionmaker()() as session:
            user = await connection_service.get_or_create_user(session, clerk_user_id)
            await credit_service.spend(
                session,
                user.id,
                cost,
                reason,
                str(conversation_id),
            )
    except Exception:
        logger.warning("question_charge_failed", conversation_id=str(conversation_id))


async def _persist_assistant(
    conversation_id: uuid.UUID, content: str, steps: list[dict[str, Any]], error: str | None
) -> None:
    """Saves the finished (or interrupted) answer. Uses its own session because
    the request-scoped one is not safe to use once streaming has started."""
    if not (content or steps or error):
        return
    for step in steps:
        if step.get("status") == "running":
            step["status"] = "failed"
    try:
        async with get_sessionmaker()() as session:
            await chat_service.add_message(
                session,
                conversation_id,
                "assistant",
                content,
                steps=steps,
                status="error" if error else "done",
                error=error,
            )
    except Exception:
        logger.exception("insights_persist_failed", conversation_id=str(conversation_id))


async def stream_answer(
    ctx: SheetContext,
    question: str,
    history: list[dict[str, str]],
    conversation_id: uuid.UUID,
    title: str,
    clerk_user_id: str,
    cost: int = credit_service.QUESTION_COST,
    reason: str = "ai_question",
) -> AsyncIterator[str]:
    """Yields SSE-formatted strings: conversation, thinking, tool_start,
    tool_result, token, done, error. Whatever was streamed is saved to Neon
    when the stream ends — including on error or client disconnect."""
    parts: list[str] = []
    steps: list[dict[str, Any]] = []
    error: str | None = None

    try:
        yield _sse("conversation", {"id": str(conversation_id), "title": title})
        llm = build_llm()
        token = ctx.gmail_token
        fetch_emails = (
            (lambda n: [asdict(m) for m in google_gmail.list_recent_messages(token, n)])
            if token
            else None
        )
        graph = build_graph(
            llm,
            build_tools(
                TableSet(ctx.tables),
                fetch_emails,
                can_draft_email=ctx.gmail_can_send,
                slack_channel=ctx.slack_channel,
                notion_page=ctx.notion_page,
                texts=TextSet(ctx.texts),
            ),
        )
        system = build_system_prompt(
            _table_infos(ctx),
            ctx.truncated,
            mail=bool(token),
            send=ctx.gmail_can_send,
            slack=bool(ctx.slack_channel),
            notion=bool(ctx.notion_page),
            documents=_text_infos(ctx),
        )
        messages = [
            SystemMessage(content=system),
            *_history_messages(history),
            HumanMessage(content=question),
        ]

        yield _sse("thinking", {})
        transcript: list[BaseMessage] = []
        async with asyncio.timeout(REQUEST_TIMEOUT_SECONDS):
            async for mode, payload in graph.astream(
                {"messages": messages}, stream_mode=["messages", "updates"]
            ):
                if mode == "messages":
                    chunk, meta = payload
                    if (
                        meta.get("langgraph_node") == "agent"
                        and isinstance(chunk, AIMessageChunk)
                        and isinstance(chunk.content, str)
                        and chunk.content
                        and not chunk.tool_call_chunks
                    ):
                        parts.append(chunk.content)
                        yield _sse("token", {"text": chunk.content})
                else:
                    for node, update in payload.items():
                        for msg in update.get("messages", []):
                            transcript.append(msg)
                            if node == "agent" and isinstance(msg, AIMessage):
                                for call in msg.tool_calls:
                                    start = {
                                        "id": call["id"],
                                        "label": tool_label(call["name"], call["args"]),
                                    }
                                    steps.append({**start, "status": "running"})
                                    yield _sse("tool_start", start)
                            elif node == "tools" and isinstance(msg, ToolMessage):
                                result = _tool_result_event(msg)
                                for step in steps:
                                    if step["id"] == result["id"]:
                                        step.update(
                                            status="done" if result["ok"] else "failed",
                                            summary=result.get("summary"),
                                            value=result.get("value"),
                                            table=result.get("table"),
                                            headline=result.get("headline"),
                                            emails=result.get("emails"),
                                            draft=result.get("draft"),
                                        )
                                yield _sse("tool_result", result)
            if not "".join(parts).strip() and not any(s.get("draft") for s in steps):
                # The model ended on an empty message (reasoning ate the token budget, or it
                # simply said nothing). Ask once more, without tools, for a final answer.
                logger.warning("insights_empty_answer", conversation_id=str(conversation_id))
                nudge = SystemMessage(
                    content="Answer the user's question now, in plain words, using the tool "
                    "results above. Do not call tools."
                )
                async for chunk in llm.astream([*messages, *transcript, nudge]):
                    if isinstance(chunk.content, str) and chunk.content:
                        parts.append(chunk.content)
                        yield _sse("token", {"text": chunk.content})
        if not "".join(parts).strip() and not any(s.get("draft") for s in steps):
            error = "I couldn't put an answer together. Please try asking again, a bit differently."
            yield _sse("error", {"code": "empty_answer", "message": error})
            return
        await _charge_question(clerk_user_id, conversation_id, cost, reason)
        yield _sse("done", {})
    except TimeoutError:
        error = "That took too long. Try a simpler question."
        yield _sse("error", {"code": "timeout", "message": error})
    except Exception:
        logger.exception("insights_stream_failed")
        error = "Something went wrong. Please try again."
        yield _sse("error", {"code": "agent_failed", "message": error})
    finally:
        # shield: still saves if the client disconnected and cancelled us.
        await asyncio.shield(
            _persist_assistant(conversation_id, "".join(parts).strip(), steps, error)
        )
