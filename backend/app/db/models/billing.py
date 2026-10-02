"""Prepaid credits (1 INR = 1 credit). `credit_ledger` is append-only: the
balance is the sum of a user's rows, so it can never drift from the history.
`razorpay_orders` records each top-up order we created so a payment can be
matched to the user who started it.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CreditLedger(Base):
    __tablename__ = "credit_ledger"
    __table_args__ = (
        # One credit per Razorpay payment, however many times verify/webhook fire.
        Index(
            "uq_credit_topup_ref",
            "ref",
            unique=True,
            postgresql_where=text("reason = 'topup'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    delta: Mapped[int] = mapped_column(Integer)  # +topup, -spend
    reason: Mapped[str] = mapped_column(String(32))
    ref: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RazorpayOrder(Base):
    __tablename__ = "razorpay_orders"

    order_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[int] = mapped_column(Integer)  # whole rupees = credits
    status: Mapped[str] = mapped_column(String(16), default="created")  # created|paid
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
