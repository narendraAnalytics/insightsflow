"""connections can hold a Slack install

Slack bot tokens don't expire and have no refresh token, so `refresh_token_enc`
and `expires_at` become nullable (Google rows always set them). `config` holds
provider-specific, non-secret details — for Slack: the workspace and the default
channel. Additive for existing rows.

Revision ID: f6b2d8e41a95
Revises: e5a9c3d72f18
Create Date: 2026-10-01 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f6b2d8e41a95"
down_revision: str | None = "e5a9c3d72f18"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("connections", sa.Column("config", postgresql.JSONB(), nullable=True))
    op.alter_column("connections", "refresh_token_enc", existing_type=sa.Text(), nullable=True)
    op.alter_column(
        "connections", "expires_at", existing_type=sa.DateTime(timezone=True), nullable=True
    )


def downgrade() -> None:
    # Slack rows have no refresh token/expiry, so they can't survive the stricter schema.
    op.execute("DELETE FROM connections WHERE provider = 'slack'")
    op.alter_column(
        "connections", "expires_at", existing_type=sa.DateTime(timezone=True), nullable=False
    )
    op.alter_column("connections", "refresh_token_enc", existing_type=sa.Text(), nullable=False)
    op.drop_column("connections", "config")
