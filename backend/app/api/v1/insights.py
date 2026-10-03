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
from app.services import (
    chat_service,
    credit_service,
    email_service,
    insights_service,
    notion_service,
    scheduled_email_service,
    slack_service,
)

router = APIRouter(prefix="/insights", tags=["insights"])


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    # None starts a new conversation; history is loaded server-side from Neon.
    conversation_id: uuid.UUID | None = None
    # Required to start a conversation (1-5 sheets/tabs); an existing chat keeps its own.
    data_source_ids: list[uuid.UUID] = Field(default_factory=list, max_length=5)
    # A new chat may also read the user's recent emails (needs Gmail + read scope).
    use_gmail: bool = False
    # Which connected Gmail account a NEW chat reads; None = the user's default account.
    gmail_connection_id: uuid.UUID | None = None


class SuggestionsResponse(BaseModel):
    sheet_name: str
    questions: list[str]


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str
    data_source_ids: list[uuid.UUID]
    uses_gmail: bool
    gmail_connection_id: uuid.UUID | None = None
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
    uses_gmail: bool
    gmail_connection_id: uuid.UUID | None = None
    messages: list[MessageOut]


@router.get("/suggestions", response_model=SuggestionsResponse)
async def suggestions(
    source_ids: list[uuid.UUID] = Query(default_factory=list, max_length=5),
    gmail: bool = False,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SuggestionsResponse:
    ctx = await insights_service.load_sheet_context(db, principal.user_id, source_ids, gmail)
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
            id=c.id,
            title=c.title,
            data_source_ids=sources[c.id],
            uses_gmail=c.uses_gmail,
            gmail_connection_id=c.gmail_connection_id,
            updated_at=c.updated_at,
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
        uses_gmail=conversation.uses_gmail,
        gmail_connection_id=conversation.gmail_connection_id,
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


class SendEmailRequest(BaseModel):
    conversation_id: uuid.UUID
    step_id: str = Field(min_length=1, max_length=200)  # the draft_email tool call's id
    to: str = Field(min_length=3, max_length=320)
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=10000)
    # Which connected Gmail account to send from; None = the user's default account.
    connection_id: uuid.UUID | None = None


class SendEmailResponse(BaseModel):
    status: str
    sent_at: str


@router.post("/email/send", response_model=SendEmailResponse)
async def send_email(
    body: SendEmailRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SendEmailResponse:
    """Sends a draft the user approved on the draft card — the only way mail is sent."""
    sent = await email_service.send_draft(
        db,
        principal.user_id,
        body.conversation_id,
        body.step_id,
        body.to,
        body.subject,
        body.body,
        body.connection_id,
    )
    return SendEmailResponse(**sent)


class PostSlackRequest(BaseModel):
    conversation_id: uuid.UUID
    step_id: str = Field(min_length=1, max_length=200)  # the draft_slack_message call's id
    channel_id: str = Field(pattern=r"^[CG][A-Z0-9]{2,40}$")
    text: str = Field(min_length=1, max_length=10000)
    # Which connected Slack workspace to post to; None = the user's default workspace.
    connection_id: uuid.UUID | None = None


class PostSlackResponse(BaseModel):
    status: str
    sent_at: str
    channel_name: str


@router.post("/slack/send", response_model=PostSlackResponse)
async def post_slack(
    body: PostSlackRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> PostSlackResponse:
    """Posts a Slack draft the user approved on the draft card — the only way anything
    is posted to Slack."""
    posted = await slack_service.send_draft(
        db,
        principal.user_id,
        body.conversation_id,
        body.step_id,
        body.channel_id,
        body.text,
        body.connection_id,
    )
    return PostSlackResponse(**posted)


class SaveNotionRequest(BaseModel):
    conversation_id: uuid.UUID
    step_id: str = Field(min_length=1, max_length=200)  # the draft_notion_page call's id
    title: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=30000)
    # Which connected Notion workspace to save to; None = the one the draft was made for.
    connection_id: uuid.UUID | None = None


class SaveNotionResponse(BaseModel):
    status: str
    sent_at: str
    url: str


@router.post("/notion/save", response_model=SaveNotionResponse)
async def save_notion(
    body: SaveNotionRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SaveNotionResponse:
    """Saves a Notion draft the user approved on the draft card — the only way anything is
    written to Notion. The parent page comes from the stored draft (or the chosen
    workspace's), never from this request."""
    saved = await notion_service.save_draft(
        db,
        principal.user_id,
        body.conversation_id,
        body.step_id,
        body.title,
        body.body,
        body.connection_id,
    )
    return SaveNotionResponse(**saved)


class ScheduleEmailRequest(SendEmailRequest):
    # Must include a UTC offset (the UI sends IST as +05:30).
    send_at: datetime


class ScheduleEmailResponse(BaseModel):
    id: str
    status: str
    send_at: str


@router.post("/email/schedule", response_model=ScheduleEmailResponse)
async def schedule_email(
    body: ScheduleEmailRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> ScheduleEmailResponse:
    """Approves a draft to be sent later (2 minutes to 7 days ahead)."""
    scheduled = await scheduled_email_service.schedule_draft(
        db,
        principal.user_id,
        body.conversation_id,
        body.step_id,
        body.to,
        body.subject,
        body.body,
        body.send_at,
        body.connection_id,
    )
    return ScheduleEmailResponse(**scheduled)


@router.post("/email/schedule/{scheduled_id}/cancel", status_code=204)
async def cancel_scheduled_email(
    scheduled_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await scheduled_email_service.cancel(db, principal.user_id, scheduled_id)


@router.post("/ask")
async def ask(
    body: AskRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    # Before anything is created: an empty balance must not leave an empty chat behind.
    await credit_service.require_credits(db, principal.user_id, credit_service.QUESTION_COST)
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
    use_gmail = existing.uses_gmail if existing else body.use_gmail
    gmail_id = existing.gmail_connection_id if existing else body.gmail_connection_id
    if not source_ids and not use_gmail:
        raise AppError(
            "This chat's sheets were removed. Start a new chat to ask about another sheet."
            if existing
            else "Choose a sheet or Gmail to ask about.",
            code="data_source_required",
        )

    # Load the sheets first so a missing/inaccessible one never leaves an empty chat behind.
    ctx = await insights_service.load_sheet_context(
        db, principal.user_id, source_ids, use_gmail, gmail_id
    )
    conversation = existing or await chat_service.create_conversation(
        db, principal.user_id, body.question, source_ids, use_gmail, gmail_id
    )
    history = await chat_service.history_for(db, conversation.id)
    await chat_service.add_message(db, conversation.id, "user", body.question)
    return StreamingResponse(
        insights_service.stream_answer(
            ctx, body.question, history, conversation.id, conversation.title, principal.user_id
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
