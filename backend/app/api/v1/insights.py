"""AI Insights — ask natural-language questions about the connected Google
Sheet, and browse saved chats. Business logic lives in app/services/
(insights_service, chat_service); the agent in app/agent/."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import Principal, get_current_principal
from app.db.session import get_db
from app.services import chat_service, insights_service

router = APIRouter(prefix="/insights", tags=["insights"])


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    # None starts a new conversation; history is loaded server-side from Neon.
    conversation_id: uuid.UUID | None = None
    # Required to start a conversation (1-5 sheets/tabs); an existing chat keeps its own.
    data_source_ids: list[uuid.UUID] = Field(default_factory=list, max_length=5)


class SuggestionsResponse(BaseModel):
    sheet_name: str
    questions: list[str]


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str
    data_source_ids: list[uuid.UUID]
    updated_at: datetime


class MessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    steps: list[dict[str, Any]]
    status: str
    error: str | None


class ConversationDetail(BaseModel):
    id: uuid.UUID
    title: str
    data_source_ids: list[uuid.UUID]
    messages: list[MessageOut]


@router.get("/suggestions", response_model=SuggestionsResponse)
async def suggestions(
    source_ids: list[uuid.UUID] = Query(..., max_length=5),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SuggestionsResponse:
    ctx = await insights_service.load_sheet_context(db, principal.user_id, source_ids)
    return SuggestionsResponse(
        sheet_name=ctx.label, questions=insights_service.suggest_questions(ctx)
    )


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationOut]:
    rows = await chat_service.list_conversations(db, principal.user_id)
    sources = await chat_service.source_ids_for(db, [c.id for c in rows])
    return [
        ConversationOut(
            id=c.id, title=c.title, data_source_ids=sources[c.id], updated_at=c.updated_at
        )
        for c in rows
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> ConversationDetail:
    conversation, messages = await chat_service.get_conversation(
        db, principal.user_id, conversation_id
    )
    sources = await chat_service.source_ids_for(db, [conversation.id])
    return ConversationDetail(
        id=conversation.id,
        title=conversation.title,
        data_source_ids=sources[conversation.id],
        messages=[
            MessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                steps=m.steps or [],
                status=m.status,
                error=m.error,
            )
            for m in messages
        ],
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await chat_service.delete_conversation(db, principal.user_id, conversation_id)


@router.post("/ask")
async def ask(
    body: AskRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    existing = (
        await chat_service.get_owned_conversation(db, principal.user_id, body.conversation_id)
        if body.conversation_id
        else None
    )
    # A chat keeps the sheets it started with; only a new chat picks them.
    source_ids = (
        (await chat_service.source_ids_for(db, [existing.id]))[existing.id]
        if existing
        else body.data_source_ids
    )
    if not source_ids:
        raise AppError(
            "This chat's sheets were removed. Start a new chat to ask about another sheet."
            if existing
            else "Choose a sheet to ask about.",
            code="data_source_required",
        )

    # Load the sheets first so a missing/inaccessible one never leaves an empty chat behind.
    ctx = await insights_service.load_sheet_context(db, principal.user_id, source_ids)
    conversation = existing or await chat_service.create_conversation(
        db, principal.user_id, body.question, source_ids
    )
    history = await chat_service.history_for(db, conversation.id)
    await chat_service.add_message(db, conversation.id, "user", body.question)
    return StreamingResponse(
        insights_service.stream_answer(
            ctx, body.question, history, conversation.id, conversation.title
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
