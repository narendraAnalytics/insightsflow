"""uploaded documents (Sarvam Extract) as chat sources

`documents` holds the rows Sarvam extracted from an upload; the original file is
not stored. `chat_conversation_documents` links a chat to the documents it asks
about, next to the existing sheet link table.

Revision ID: g7c3e9f52b06
Revises: f6b2d8e41a95
Create Date: 2026-10-02 11:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "g7c3e9f52b06"
down_revision: str | None = "f6b2d8e41a95"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("template", sa.String(32), nullable=False),
        sa.Column("prompt", sa.Text()),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("error", sa.Text()),
        sa.Column("page_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("headers", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("rows", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_documents_user_id", "documents", ["user_id"])

    op.create_table(
        "chat_conversation_documents",
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chat_conversations.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index(
        "ix_chat_conversation_documents_document_id",
        "chat_conversation_documents",
        ["document_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_conversation_documents_document_id", "chat_conversation_documents")
    op.drop_table("chat_conversation_documents")
    op.drop_index("ix_documents_user_id", "documents")
    op.drop_table("documents")
