"""AI Insights — ask natural-language questions about the connected Google
Sheet, and browse saved chats. Business logic lives in app/services/
(insights_service, chat_service); the agent in app/agent/."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Principal, get_current_principal
from app.db.session import get_db
from app.services import chat_service, insights_service

router = APIRouter(prefix="/insights", tags=["insights"])


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    # None starts a new conversation; history is loaded server-side from Neon.
    conversation_id: uuid.UUID | None = None


class SuggestionsResponse(BaseModel):
    sheet_name: str
    questions: list[str]


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str
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
    messages: list[MessageOut]


@router.get("/suggestions", response_model=SuggestionsResponse)
async def suggestions(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SuggestionsResponse:
    ctx = await insights_service.load_sheet_context(db, principal.user_id)
    return SuggestionsResponse(
        sheet_name=ctx.name, questions=insights_service.suggest_questions(ctx.frame)
    )


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationOut]:
    rows = await chat_service.list_conversations(db, principal.user_id)
    return [ConversationOut(id=c.id, title=c.title, updated_at=c.updated_at) for c in rows]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> ConversationDetail:
    conversation, messages = await chat_service.get_conversation(
        db, principal.user_id, conversation_id
    )
    return ConversationDetail(
        id=conversation.id,
        title=conversation.title,
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
    # Load the sheet first so a missing connection never leaves an empty chat behind.
    ctx = await insights_service.load_sheet_context(db, principal.user_id)
    conversation = await chat_service.resolve_conversation(
        db, principal.user_id, body.conversation_id, body.question
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
