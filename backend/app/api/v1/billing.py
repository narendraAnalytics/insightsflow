"""Credits: balance, buying (Razorpay Checkout), and the payment webhook."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import Principal, get_current_principal
from app.db.session import get_db
from app.services import credit_service

router = APIRouter(prefix="/billing", tags=["billing"])
webhook_router = APIRouter(prefix="/webhooks/razorpay", tags=["webhooks"])


class EntryOut(BaseModel):
    delta: int
    reason: str
    created_at: datetime


class BalanceResponse(BaseModel):
    credits: int
    connect_cost: int
    question_cost: int
    automation_cost: int
    test_mode: bool
    entries: list[EntryOut]


class OrderRequest(BaseModel):
    amount: int = Field(ge=credit_service.MIN_TOPUP, le=credit_service.MAX_TOPUP)


class OrderResponse(BaseModel):
    order_id: str
    key_id: str
    amount: int


class VerifyRequest(BaseModel):
    order_id: str = Field(max_length=64)
    payment_id: str = Field(max_length=64)
    signature: str = Field(max_length=128)


class VerifyResponse(BaseModel):
    credits: int


@router.get("/balance", response_model=BalanceResponse)
async def balance(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> BalanceResponse:
    entries = await credit_service.recent_entries(db, principal.user_id)
    return BalanceResponse(
        credits=await credit_service.get_balance(db, principal.user_id),
        connect_cost=credit_service.CONNECT_COST,
        question_cost=credit_service.QUESTION_COST,
        automation_cost=credit_service.AUTOMATION_COST,
        test_mode=(get_settings().razorpay_key_id or "").startswith("rzp_test_"),
        entries=[
            EntryOut(delta=e.delta, reason=e.reason, created_at=e.created_at) for e in entries
        ],
    )


@router.post("/orders", response_model=OrderResponse)
async def create_order(
    body: OrderRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    order_id, key_id = await credit_service.create_order(db, principal.user_id, body.amount)
    return OrderResponse(order_id=order_id, key_id=key_id, amount=body.amount)


@router.post("/verify", response_model=VerifyResponse)
async def verify(
    body: VerifyRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> VerifyResponse:
    credits = await credit_service.verify_and_grant(
        db, principal.user_id, body.order_id, body.payment_id, body.signature
    )
    return VerifyResponse(credits=credits)


@webhook_router.post("")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """Backup for a closed tab: `order.paid` credits the same way /verify does."""
    body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")
    if not credit_service.verify_webhook_signature(body, signature):
        raise AppError("Invalid signature", code="webhook_verification_failed")
    event = json.loads(body)
    if event.get("event") == "order.paid":
        payload = event.get("payload", {})
        order_id = payload.get("order", {}).get("entity", {}).get("id")
        payment_id = payload.get("payment", {}).get("entity", {}).get("id")
        if order_id and payment_id:
            await credit_service.grant_topup(db, order_id, payment_id)
    return {"ok": True}
