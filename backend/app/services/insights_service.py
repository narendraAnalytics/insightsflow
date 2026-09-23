"""Business logic for AI Insights: load the user's sheet, run the LangGraph
agent, and translate its stream into UI-friendly events (no FastAPI imports)."""

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
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

from app.agent.graph import TableInfo, build_graph, build_system_prompt, shared_columns
from app.agent.llm import build_llm
from app.agent.tools import TableSet, build_frame, build_tools, describe_schema, tool_label
from app.core.errors import AppError
from app.db.models.data_source import DataSource
from app.db.session import get_sessionmaker
from app.integrations.google import sheets as google_sheets
from app.services import chat_service, connection_service, data_source_service

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

    @property
    def label(self) -> str:
        return " + ".join(self.tables)


def _table_names(sources: list[DataSource]) -> list[str]:
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


async def load_sheet_context(
    session: AsyncSession, clerk_user_id: str, source_ids: list[uuid.UUID]
) -> SheetContext:
    """All DB + Google I/O happens here, before streaming starts, so failures
    surface as normal HTTP errors and the SSE generator never touches the session."""
    ids = list(dict.fromkeys(source_ids))  # de-duplicate, keep order
    if not ids:
        raise AppError("Choose a sheet to ask about.", code="data_source_required")
    if len(ids) > MAX_SOURCES_PER_CHAT:
        raise TooManySourcesInChat(f"A chat can use up to {MAX_SOURCES_PER_CHAT} sheets at once")

    sources = [await data_source_service.get_source(session, clerk_user_id, i) for i in ids]
    connection = await connection_service.get_connection(session, clerk_user_id)
    access_token = await connection_service.get_valid_access_token(session, connection)

    previews = await asyncio.gather(
        *(
            asyncio.to_thread(
                google_sheets.fetch_sheet_preview,
                access_token,
                src.external_id,
                src.tab_title or None,
                MAX_SHEET_ROWS,
            )
            for src in sources
        )
    )
    frames = [build_frame(p.headers, p.rows) for p in previews]
    return SheetContext(
        tables=dict(zip(_table_names(sources), frames, strict=True)),
        truncated=any(len(f) >= MAX_SHEET_ROWS for f in frames),
    )


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
    return list(dict.fromkeys(out))[:4]


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
    }


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
        graph = build_graph(llm, build_tools(TableSet(ctx.tables)))
        system = build_system_prompt(_table_infos(ctx), ctx.truncated)
        messages = [
            SystemMessage(content=system),
            *_history_messages(history),
            HumanMessage(content=question),
        ]

        yield _sse("thinking", {})
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
                                        )
                                yield _sse("tool_result", result)
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
