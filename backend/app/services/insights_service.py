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

from app.agent.graph import build_graph, build_system_prompt
from app.agent.llm import build_llm
from app.agent.tools import build_frame, build_tools, describe_schema, tool_label
from app.core.errors import NotFoundError
from app.db.session import get_sessionmaker
from app.integrations.google import sheets as google_sheets
from app.services import chat_service, connection_service

logger = structlog.get_logger(__name__)

MAX_SHEET_ROWS = 5000
MAX_HISTORY_TURNS = 10
REQUEST_TIMEOUT_SECONDS = 90


@dataclass
class SheetContext:
    name: str
    frame: pd.DataFrame
    truncated: bool


async def load_sheet_context(session: AsyncSession, clerk_user_id: str) -> SheetContext:
    """All DB + Google I/O happens here, before streaming starts, so failures
    surface as normal HTTP errors and the SSE generator never touches the session."""
    connection = await connection_service.get_connection(session, clerk_user_id)
    if not connection.google_sheet_id:
        raise NotFoundError("No spreadsheet selected yet — pick one on the Integrations page")
    access_token = await connection_service.get_valid_access_token(session, connection)
    preview = await asyncio.to_thread(
        google_sheets.fetch_sheet_preview,
        access_token,
        connection.google_sheet_id,
        MAX_SHEET_ROWS,
    )
    frame = build_frame(preview.headers, preview.rows)
    return SheetContext(
        name=connection.google_sheet_name or "Spreadsheet",
        frame=frame,
        truncated=len(frame) >= MAX_SHEET_ROWS,
    )


def suggest_questions(frame: pd.DataFrame) -> list[str]:
    """Starter questions built from the sheet's real columns."""
    schema = describe_schema(frame)
    numbers = [c["column"] for c in schema if c["type"] == "number"]
    texts = [c["column"] for c in schema if c["type"] == "text"]
    out = ["Give me a summary of this sheet"]
    if numbers:
        out.append(f"What is the total {numbers[0]}?")
    if numbers and texts:
        out.append(f"Which {texts[0]} has the highest {numbers[0]}?")
    if len(numbers) > 1:
        out.append(f"What is the average {numbers[1]}?")
    elif numbers:
        out.append(f"Show the top 5 rows by {numbers[0]}")
    return out


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
        graph = build_graph(llm, build_tools(ctx.frame))
        system = build_system_prompt(
            ctx.name, len(ctx.frame), describe_schema(ctx.frame), ctx.truncated
        )
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
