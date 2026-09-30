"""chat conversations can use Gmail as a source

A chat may ask about connected sheets, the user's Gmail, or both. Existing
chats are sheet-only, so the column defaults to false.

Revision ID: d4f8a2c61b73
Revises: c3b1e7a94d20
Create Date: 2026-09-30 16:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d4f8a2c61b73"
down_revision: str | None = "c3b1e7a94d20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "chat_conversations",
        sa.Column("uses_gmail", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("chat_conversations", "uses_gmail")
