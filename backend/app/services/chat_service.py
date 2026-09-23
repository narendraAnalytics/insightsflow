"""Persistence for AI Insights chats (Neon). No FastAPI imports — routes stay
thin and call these. Every query is scoped to the current user."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models.chat import ChatConversation, ChatConversationSource, ChatMessage
from app.services.connection_service import get_or_create_user

TITLE_MAX = 60
HISTORY_LIMIT = 20


def make_title(question: str) -> str:
    text = " ".join(question.split())
    return text if len(text) <= TITLE_MAX else text[: TITLE_MAX - 1].rstrip() + "…"


async def get_owned_conversation(
    session: AsyncSession, clerk_user_id: str, conversation_id: uuid.UUID
) -> ChatConversation:
    user = await get_or_create_user(session, clerk_user_id)
    result = await session.execute(
        select(ChatConversation).where(
            ChatConversation.id == conversation_id, ChatConversation.user_id == user.id
        )
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise NotFoundError("Conversation not found")
    return conversation


async def create_conversation(
    session: AsyncSession,
    clerk_user_id: str,
    first_question: str,
    source_ids: list[uuid.UUID],
) -> ChatConversation:
    user = await get_or_create_user(session, clerk_user_id)
    conversation = ChatConversation(user_id=user.id, title=make_title(first_question))
    session.add(conversation)
    await session.flush()
    session.add_all(
        ChatConversationSource(conversation_id=conversation.id, data_source_id=sid)
        for sid in dict.fromkeys(source_ids)
    )
    await session.flush()
    return conversation


async def source_ids_for(
    session: AsyncSession, conversation_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[uuid.UUID]]:
    """Sheets each conversation asks about (a removed sheet simply drops out)."""
    if not conversation_ids:
        return {}
    result = await session.execute(
        select(ChatConversationSource.conversation_id, ChatConversationSource.data_source_id)
        .where(ChatConversationSource.conversation_id.in_(conversation_ids))
        .order_by(ChatConversationSource.data_source_id)
    )
    grouped: dict[uuid.UUID, list[uuid.UUID]] = {cid: [] for cid in conversation_ids}
    for conversation_id, source_id in result.all():
        grouped[conversation_id].append(source_id)
    return grouped


async def history_for(session: AsyncSession, conversation_id: uuid.UUID) -> list[dict[str, str]]:
    """Recent finished turns, oldest first, for the model's context."""
    result = await session.execute(
        select(ChatMessage)
        .where(
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.status == "done",
            ChatMessage.content != "",
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(HISTORY_LIMIT)
    )
    rows = list(result.scalars())[::-1]
    return [{"role": m.role, "content": m.content} for m in rows]


async def add_message(
    session: AsyncSession,
    conversation_id: uuid.UUID,
    role: str,
    content: str,
    steps: list[dict[str, Any]] | None = None,
    status: str = "done",
    error: str | None = None,
) -> ChatMessage:
    message = ChatMessage(
        conversation_id=conversation_id,
        role=role,
        content=content,
        steps=steps or [],
        status=status,
        error=error,
    )
    session.add(message)
    # Bumps the conversation to the top of the history list.
    conversation = await session.get(ChatConversation, conversation_id)
    if conversation is not None:
        conversation.updated_at = datetime.now(UTC)
    await session.commit()
    return message


async def list_conversations(session: AsyncSession, clerk_user_id: str) -> list[ChatConversation]:
    user = await get_or_create_user(session, clerk_user_id)
    result = await session.execute(
        select(ChatConversation)
        .where(ChatConversation.user_id == user.id)
        .order_by(ChatConversation.updated_at.desc())
        .limit(100)
    )
    return list(result.scalars())


async def get_conversation(
    session: AsyncSession, clerk_user_id: str, conversation_id: uuid.UUID
) -> tuple[ChatConversation, list[ChatMessage]]:
    conversation = await get_owned_conversation(session, clerk_user_id, conversation_id)
    result = await session.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation.id)
        .order_by(ChatMessage.created_at.asc())
    )
    return conversation, list(result.scalars())


async def delete_conversation(
    session: AsyncSession, clerk_user_id: str, conversation_id: uuid.UUID
) -> None:
    conversation = await get_owned_conversation(session, clerk_user_id, conversation_id)
    await session.execute(delete(ChatConversation).where(ChatConversation.id == conversation.id))
    await session.commit()
