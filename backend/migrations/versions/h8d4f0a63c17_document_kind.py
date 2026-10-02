"""documents get a kind: table (Extract) or text (Digitise)

Text documents keep their passages (page, section, text) in the existing `rows`
column, so only the discriminator is new. Existing rows are all tables.

Revision ID: h8d4f0a63c17
Revises: g7c3e9f52b06
Create Date: 2026-10-02 15:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "h8d4f0a63c17"
down_revision: str | None = "g7c3e9f52b06"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("kind", sa.String(8), nullable=False, server_default="table"),
    )


def downgrade() -> None:
    op.drop_column("documents", "kind")
