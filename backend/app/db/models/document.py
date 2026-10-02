"""An uploaded document turned into a table by Sarvam Document Intelligence
(Extract). Only the extracted rows are kept — the original file is discarded as
soon as Sarvam has read it. Scoped to `user_id`, like every other table (no
Organizations table yet).

`status` runs processing -> ready | failed. While processing, the background job
in document_service owns the row; a row stuck in `processing` past a timeout is
shown as failed (the job died with a server restart)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    filename: Mapped[str] = mapped_column(String(255))
    template: Mapped[str] = mapped_column(String(32))  # invoice | bank_statement | receipt | custom
    prompt: Mapped[str | None] = mapped_column(Text)  # what to extract, for template=custom
    status: Mapped[str] = mapped_column(String(16), default="processing")
    error: Mapped[str | None] = mapped_column(Text)
    page_count: Mapped[int] = mapped_column(Integer, default=0)

    headers: Mapped[list] = mapped_column(JSONB, default=list)
    rows: Mapped[list] = mapped_column(JSONB, default=list)  # list of row lists, aligned to headers
    row_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
