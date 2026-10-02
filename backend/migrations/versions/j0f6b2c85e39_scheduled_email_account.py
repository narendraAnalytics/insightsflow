"""scheduled emails remember which Gmail account they go out from

Revision ID: j0f6b2c85e39
Revises: i9e5a1b74d28
Create Date: 2026-10-02 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "j0f6b2c85e39"
down_revision: str | None = "i9e5a1b74d28"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "scheduled_emails",
        sa.Column(
            "connection_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("connections.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("scheduled_emails", "connection_id")
