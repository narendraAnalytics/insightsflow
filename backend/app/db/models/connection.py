"""A user's connection to an external provider (Google Sheets first —
Notion/Slack later reuse this same table with a different `provider`
value, per roadmap.txt's data model). Scoped to `user_id`, not `org_id`:
no Organizations table backs auth yet (see app/core/security.py), so this
is honestly single-user for now rather than pretending multi-tenancy
already exists.

access_token_enc/refresh_token_enc are Fernet-encrypted (app/core/crypto.py)
— never store OAuth tokens in plaintext.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Connection(Base):
    __tablename__ = "connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    provider: Mapped[str] = mapped_column(String(32))  # "google_sheets"
    status: Mapped[str] = mapped_column(String(16), default="connected")  # connected|revoked
    external_account_email: Mapped[str | None] = mapped_column(String(320))

    access_token_enc: Mapped[str] = mapped_column(Text)
    refresh_token_enc: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    scopes: Mapped[str] = mapped_column(String(512))
    key_version: Mapped[str] = mapped_column(String(8))

    # Single selected spreadsheet per connection (MVP — see roadmap.txt's
    # fuller `data_sources` table for the eventual multi-source version).
    google_sheet_id: Mapped[str | None] = mapped_column(String(128))
    google_sheet_name: Mapped[str | None] = mapped_column(String(255))
    google_sheet_headers: Mapped[list | None] = mapped_column(JSONB)
    google_sheet_row_count: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
