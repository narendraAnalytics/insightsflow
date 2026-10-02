"""credits: ledger and Razorpay top-up orders

Revision ID: i9e5a1b74d28
Revises: h8d4f0a63c17
Create Date: 2026-10-02 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "i9e5a1b74d28"
down_revision: str | None = "h8d4f0a63c17"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "credit_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("delta", sa.Integer, nullable=False),
        sa.Column("reason", sa.String(32), nullable=False),
        sa.Column("ref", sa.String(64)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_credit_ledger_user_id", "credit_ledger", ["user_id"])
    op.create_index(
        "uq_credit_topup_ref",
        "credit_ledger",
        ["ref"],
        unique=True,
        postgresql_where=sa.text("reason = 'topup'"),
    )
    op.create_table(
        "razorpay_orders",
        sa.Column("order_id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="created"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_razorpay_orders_user_id", "razorpay_orders", ["user_id"])


def downgrade() -> None:
    op.drop_table("razorpay_orders")
    op.drop_table("credit_ledger")
