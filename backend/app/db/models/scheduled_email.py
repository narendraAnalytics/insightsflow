"""An email the user approved to be sent later (AI Insights draft card ->
"Schedule"). Gmail's API has no scheduled-send, so we hold the approved content
here and a once-a-minute external pinger calls `/internal/email/run-due`, which
sends whatever is due from the user's own Gmail.

The content is frozen at the moment the user clicked Schedule — nothing is
re-computed later. Scoped to `user_id` like the other tables (no Organizations
table yet). `conversation_id`/`step_id` point back at the draft card so its state
can be updated; deleting the chat only detaches the row (the user's approved
mail still goes out).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScheduledEmail(Base):
    __tablename__ = "scheduled_emails"
    __table_args__ = (Index("ix_scheduled_emails_status_send_at", "status", "send_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_conversations.id", ondelete="SET NULL")
    )
    step_id: Mapped[str] = mapped_column(String(200))
    # The Gmail account it goes out from (the user's choice on the draft card). NULL = the
    # user's default account at send time. SET NULL if that account is disconnected.
    connection_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("connections.id", ondelete="SET NULL")
    )

    to_address: Mapped[str] = mapped_column(String(320))
    subject: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)

    send_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # scheduled | sending | sent | failed | cancelled
    status: Mapped[str] = mapped_column(String(16), default="scheduled")
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    gmail_message_id: Mapped[str | None] = mapped_column(String(64))
    error: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
