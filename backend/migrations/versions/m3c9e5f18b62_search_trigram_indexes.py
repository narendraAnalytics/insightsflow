"""pg_trgm indexes for the dashboard's global search

Revision ID: m3c9e5f18b62
Revises: l2b8d4e07a51
Create Date: 2026-10-06 10:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

revision: str = "m3c9e5f18b62"
down_revision: str | None = "l2b8d4e07a51"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (index name, table, column)
INDEXES = [
    ("ix_trgm_data_sources_name", "data_sources", "name"),
    ("ix_trgm_data_sources_tab_title", "data_sources", "tab_title"),
    ("ix_trgm_documents_filename", "documents", "filename"),
    ("ix_trgm_chat_conversations_title", "chat_conversations", "title"),
    ("ix_trgm_chat_messages_content", "chat_messages", "content"),
]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    for name, table, column in INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} USING gin ({column} gin_trgm_ops)")


def downgrade() -> None:
    for name, _table, _column in INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
    # The extension is left installed: other objects may come to rely on it.
