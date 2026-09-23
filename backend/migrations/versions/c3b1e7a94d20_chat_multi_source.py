"""chat conversations can span several data sources

Replaces chat_conversations.data_source_id with a link table so one chat can
ask across several sheets/tabs (joined by the agent). Existing chats keep their
source via a backfill; the downgrade restores the column from each chat's
oldest-linked source.

Revision ID: c3b1e7a94d20
Revises: 62f423ef33ad
Create Date: 2026-09-24 10:05:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3b1e7a94d20"
down_revision: str | None = "62f423ef33ad"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chat_conversation_sources",
        sa.Column("conversation_id", sa.UUID(), nullable=False),
        sa.Column("data_source_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["chat_conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["data_source_id"], ["data_sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("conversation_id", "data_source_id"),
    )
    op.create_index(
        op.f("ix_chat_conversation_sources_data_source_id"),
        "chat_conversation_sources",
        ["data_source_id"],
        unique=False,
    )

    op.execute(
        """
        INSERT INTO chat_conversation_sources (conversation_id, data_source_id)
        SELECT id, data_source_id FROM chat_conversations WHERE data_source_id IS NOT NULL
        """
    )

    op.drop_constraint(
        "fk_chat_conversations_data_source_id", "chat_conversations", type_="foreignkey"
    )
    op.drop_index(op.f("ix_chat_conversations_data_source_id"), table_name="chat_conversations")
    op.drop_column("chat_conversations", "data_source_id")


def downgrade() -> None:
    op.add_column("chat_conversations", sa.Column("data_source_id", sa.UUID(), nullable=True))
    op.execute(
        """
        UPDATE chat_conversations cc
        SET data_source_id = s.data_source_id
        FROM (
            SELECT DISTINCT ON (l.conversation_id) l.conversation_id, l.data_source_id
            FROM chat_conversation_sources l
            JOIN data_sources d ON d.id = l.data_source_id
            ORDER BY l.conversation_id, d.created_at ASC
        ) s
        WHERE s.conversation_id = cc.id
        """
    )
    op.create_index(
        op.f("ix_chat_conversations_data_source_id"),
        "chat_conversations",
        ["data_source_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_chat_conversations_data_source_id",
        "chat_conversations",
        "data_sources",
        ["data_source_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_index(
        op.f("ix_chat_conversation_sources_data_source_id"), table_name="chat_conversation_sources"
    )
    op.drop_table("chat_conversation_sources")
