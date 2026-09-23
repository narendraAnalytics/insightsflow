"""add data sources

Moves the single spreadsheet stored on `connections` into a proper
`data_sources` table (one row per spreadsheet+tab), so a connection can own
many. Existing selections are backfilled — nothing is lost — and existing chats
are bound to their user's migrated source. The downgrade restores the columns
from each connection's oldest source.

Backfilled rows get tab_title = '' meaning "first tab, not yet resolved": the
old schema never stored the tab name. The app resolves and persists the real
title the first time it syncs the source (connection_service.sync_source).

Revision ID: 62f423ef33ad
Revises: a006353f51bc
Create Date: 2026-09-23 22:41:24.776112

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "62f423ef33ad"
down_revision: str | None = "a006353f51bc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "data_sources",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("connection_id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("external_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("tab_title", sa.String(length=255), nullable=False),
        sa.Column("tab_id", sa.Integer(), nullable=True),
        sa.Column("headers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column(
            "synced_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["connection_id"], ["connections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("connection_id", "external_id", "tab_title", name="uq_data_source_tab"),
    )
    op.create_index(
        op.f("ix_data_sources_connection_id"), "data_sources", ["connection_id"], unique=False
    )
    op.create_index(op.f("ix_data_sources_user_id"), "data_sources", ["user_id"], unique=False)

    op.add_column("chat_conversations", sa.Column("data_source_id", sa.UUID(), nullable=True))
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

    # Backfill: each connection's selected sheet becomes a data source.
    op.execute(
        """
        INSERT INTO data_sources
            (id, user_id, connection_id, provider, external_id, name, tab_title,
             headers, row_count)
        SELECT gen_random_uuid(), c.user_id, c.id, c.provider, c.google_sheet_id,
               COALESCE(c.google_sheet_name, 'Spreadsheet'), '',
               COALESCE(c.google_sheet_headers, '[]'::jsonb),
               COALESCE(c.google_sheet_row_count, 0)
        FROM connections c
        WHERE c.google_sheet_id IS NOT NULL
        """
    )
    # Existing chats were about that one sheet.
    op.execute(
        """
        UPDATE chat_conversations cc
        SET data_source_id = ds.id
        FROM data_sources ds
        WHERE ds.user_id = cc.user_id
        """
    )

    op.drop_column("connections", "google_sheet_headers")
    op.drop_column("connections", "google_sheet_id")
    op.drop_column("connections", "google_sheet_row_count")
    op.drop_column("connections", "google_sheet_name")


def downgrade() -> None:
    op.add_column("connections", sa.Column("google_sheet_name", sa.String(255), nullable=True))
    op.add_column("connections", sa.Column("google_sheet_row_count", sa.Integer(), nullable=True))
    op.add_column("connections", sa.Column("google_sheet_id", sa.String(128), nullable=True))
    op.add_column(
        "connections",
        sa.Column("google_sheet_headers", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    # A connection can only hold one sheet again: keep its oldest source.
    op.execute(
        """
        UPDATE connections c
        SET google_sheet_id = s.external_id,
            google_sheet_name = s.name,
            google_sheet_headers = s.headers,
            google_sheet_row_count = s.row_count
        FROM (
            SELECT DISTINCT ON (connection_id) connection_id, external_id, name, headers, row_count
            FROM data_sources
            ORDER BY connection_id, created_at ASC
        ) s
        WHERE s.connection_id = c.id
        """
    )

    op.drop_constraint("fk_chat_conversations_data_source_id", "chat_conversations", type_="foreignkey")
    op.drop_index(op.f("ix_chat_conversations_data_source_id"), table_name="chat_conversations")
    op.drop_column("chat_conversations", "data_source_id")
    op.drop_index(op.f("ix_data_sources_user_id"), table_name="data_sources")
    op.drop_index(op.f("ix_data_sources_connection_id"), table_name="data_sources")
    op.drop_table("data_sources")
