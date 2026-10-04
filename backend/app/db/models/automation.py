"""Scheduled AI reports ("automations") and their runs.

An automation is a saved question over chosen sheets plus a schedule and where to
deliver the result. Each run asks the question like a normal AI Insights chat (a real
`chat_conversations` row, so the existing draft cards and send/post/save paths work
unchanged) and then WAITS for the user's approval: the agent only drafts, a person
sends. Scoped to `user_id` like the other tables (no Organizations table yet).
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Automation(Base):
    __tablename__ = "automations"
    __table_args__ = (Index("ix_automations_enabled_next_run", "enabled", "next_run_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(80))
    question: Mapped[str] = mapped_column(Text)
    # Sheet-tab / document ids as strings; a removed one just fails the run with a clear message.
    data_source_ids: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    # The Gmail "profile" the run works as (decides Slack/Notion workspaces and sent-from).
    gmail_connection_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("connections.id", ondelete="SET NULL")
    )
    # {"email": "a@b.com" | null, "slack": bool, "notion": bool}; all empty = in-app only.
    delivery: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    # daily | weekly | monthly, at hour:minute IST. weekday 0=Mon..6=Sun, month_day 1..28.
    frequency: Mapped[str] = mapped_column(String(10))
    weekday: Mapped[int | None] = mapped_column(Integer)
    month_day: Mapped[int | None] = mapped_column(Integer)
    hour: Mapped[int] = mapped_column(Integer, default=9)
    minute: Mapped[int] = mapped_column(Integer, default=0)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AutomationRun(Base):
    __tablename__ = "automation_runs"
    __table_args__ = (Index("ix_automation_runs_user_started", "user_id", "started_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    automation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("automations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    # The chat holding the answer and its drafts; SET NULL if the user deletes that chat.
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_conversations.id", ondelete="SET NULL")
    )
    # running | awaiting_approval | completed | failed | dismissed
    status: Mapped[str] = mapped_column(String(20), default="running")
    trigger: Mapped[str] = mapped_column(String(10), default="schedule")  # schedule | manual
    summary: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
