"""Prepaid credits: 1 INR = 1 credit. The balance is the sum of the user's
`credit_ledger` rows; every spend locks the user row first so two concurrent
requests can't both spend the same credits. Razorpay is called over plain
httpx (Orders API) and signatures are checked with HMAC — no SDK needed.
"""

import hashlib
import hmac
import uuid
from dataclasses import dataclass
from datetime import datetime

import httpx
import structlog
from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, NotFoundError
from app.db.models.billing import CreditLedger, RazorpayOrder
from app.db.models.user import User
from app.services import connection_service

logger = structlog.get_logger(__name__)

# What things cost, in credits.
CONNECT_COST = 50
QUESTION_COST = 2
AUTOMATION_COST = 5

MIN_TOPUP = 10
MAX_TOPUP = 10_000
RAZORPAY_API = "https://api.razorpay.com/v1"


class InsufficientCredits(AppError):
    status_code = status.HTTP_402_PAYMENT_REQUIRED
    code = "insufficient_credits"


class BillingNotConfigured(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "billing_not_configured"


class PaymentVerificationFailed(AppError):
    code = "payment_verification_failed"


@dataclass
class LedgerEntry:
    delta: int
    reason: str
    created_at: datetime


async def _lock_user(session: AsyncSession, user_id: uuid.UUID) -> None:
    await session.execute(select(User.id).where(User.id == user_id).with_for_update())


async def _balance(session: AsyncSession, user_id: uuid.UUID) -> int:
    result = await session.execute(
        select(func.coalesce(func.sum(CreditLedger.delta), 0)).where(
            CreditLedger.user_id == user_id
        )
    )
    return int(result.scalar_one())


async def get_balance(session: AsyncSession, clerk_user_id: str) -> int:
    user = await connection_service.get_or_create_user(session, clerk_user_id)
    return await _balance(session, user.id)


async def recent_entries(
    session: AsyncSession, clerk_user_id: str, limit: int = 20
) -> list[LedgerEntry]:
    user = await connection_service.get_or_create_user(session, clerk_user_id)
    result = await session.execute(
        select(CreditLedger)
        .where(CreditLedger.user_id == user.id)
        .order_by(CreditLedger.created_at.desc())
        .limit(limit)
    )
    return [LedgerEntry(r.delta, r.reason, r.created_at) for r in result.scalars()]


async def require_credits(session: AsyncSession, clerk_user_id: str, amount: int) -> None:
    """Cheap pre-flight check (no lock) so we fail before starting OAuth or a run."""
    if await get_balance(session, clerk_user_id) < amount:
        raise InsufficientCredits(f"This needs {amount} credits. Buy credits to continue.")


async def spend(
    session: AsyncSession,
    user_id: uuid.UUID,
    amount: int,
    reason: str,
    ref: str | None = None,
    *,
    commit: bool = True,
) -> None:
    """Debits `amount` credits or raises InsufficientCredits. With commit=False
    the debit rides in the caller's transaction, so it only lands if their work
    does (e.g. a connection row that is saved in the same commit)."""
    await _lock_user(session, user_id)
    if await _balance(session, user_id) < amount:
        raise InsufficientCredits(f"This needs {amount} credits. Buy credits to continue.")
    session.add(CreditLedger(user_id=user_id, delta=-amount, reason=reason, ref=ref))
    if commit:
        await session.commit()
    else:
        await session.flush()


def _keys() -> tuple[str, str]:
    s = get_settings()
    if not (s.razorpay_key_id and s.razorpay_key_secret):
        raise BillingNotConfigured("Payments aren't configured yet.")
    return s.razorpay_key_id, s.razorpay_key_secret


async def create_order(session: AsyncSession, clerk_user_id: str, amount: int) -> tuple[str, str]:
    """Creates a Razorpay order for `amount` rupees. Returns (order_id, key_id)."""
    if not MIN_TOPUP <= amount <= MAX_TOPUP:
        raise AppError(
            f"Choose an amount between {MIN_TOPUP} and {MAX_TOPUP}.", code="invalid_amount"
        )
    key_id, key_secret = _keys()
    user = await connection_service.get_or_create_user(session, clerk_user_id)
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{RAZORPAY_API}/orders",
            auth=(key_id, key_secret),
            json={
                "amount": amount * 100,  # paise
                "currency": "INR",
                "receipt": f"cr_{uuid.uuid4().hex[:24]}",
                "notes": {"user_id": str(user.id)},
            },
        )
    if resp.status_code != 200:
        logger.error("razorpay_order_failed", status=resp.status_code, body=resp.text[:300])
        raise AppError("Couldn't start the payment. Try again.", code="payment_start_failed")
    order_id = resp.json()["id"]
    session.add(RazorpayOrder(order_id=order_id, user_id=user.id, amount=amount))
    await session.commit()
    return order_id, key_id


def _hmac_hex(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def verify_checkout_signature(order_id: str, payment_id: str, signature: str) -> bool:
    _, key_secret = _keys()
    expected = _hmac_hex(key_secret, f"{order_id}|{payment_id}".encode())
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    secret = get_settings().razorpay_webhook_secret
    if not secret:
        return False
    return hmac.compare_digest(_hmac_hex(secret, body), signature)


async def grant_topup(session: AsyncSession, order_id: str, payment_id: str) -> int:
    """Credits the order's amount once per payment (idempotent). Returns the
    user's balance. The amount comes from OUR order row, never from the client."""
    order = (
        await session.execute(
            select(RazorpayOrder).where(RazorpayOrder.order_id == order_id).with_for_update()
        )
    ).scalar_one_or_none()
    if order is None:
        raise NotFoundError("Unknown order")

    await _lock_user(session, order.user_id)
    already = (
        await session.execute(
            select(CreditLedger.id).where(
                CreditLedger.reason == "topup", CreditLedger.ref == payment_id
            )
        )
    ).first()
    if already is None:
        session.add(
            CreditLedger(user_id=order.user_id, delta=order.amount, reason="topup", ref=payment_id)
        )
        order.status = "paid"
        await session.commit()
        logger.info("credits_granted", order_id=order_id, amount=order.amount)
    return await _balance(session, order.user_id)


async def verify_and_grant(
    session: AsyncSession, clerk_user_id: str, order_id: str, payment_id: str, signature: str
) -> int:
    user = await connection_service.get_or_create_user(session, clerk_user_id)
    order = (
        await session.execute(select(RazorpayOrder).where(RazorpayOrder.order_id == order_id))
    ).scalar_one_or_none()
    if order is None or order.user_id != user.id:
        raise NotFoundError("Unknown order")
    if not verify_checkout_signature(order_id, payment_id, signature):
        raise PaymentVerificationFailed("Payment couldn't be verified.")
    return await grant_topup(session, order_id, payment_id)
