"""A queryable data source: one spreadsheet + one tab, reached through a
provider connection. A single Google connection can own many of these (several
spreadsheets, or several tabs of one spreadsheet). Scoped to `user_id` for the
same reason as Connection (no Organizations table yet).

`headers`/`row_count` are a cache of the live sheet, refreshed at most every
few minutes (see connection_service.refresh_source_stats); `synced_at` is when
that cache was last checked."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DataSource(Base):
    __tablename__ = "data_sources"
    __table_args__ = (
        UniqueConstraint("connection_id", "external_id", "tab_title", name="uq_data_source_tab"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("connections.id", ondelete="CASCADE"), index=True
    )

    provider: Mapped[str] = mapped_column(String(32), default="google_sheets")
    external_id: Mapped[str] = mapped_column(String(128))  # spreadsheet id
    name: Mapped[str] = mapped_column(String(255))  # spreadsheet name
    tab_title: Mapped[str] = mapped_column(String(255))
    tab_id: Mapped[int | None] = mapped_column(Integer)  # Google's numeric sheetId (gid)

    headers: Mapped[list] = mapped_column(JSONB, default=list)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
