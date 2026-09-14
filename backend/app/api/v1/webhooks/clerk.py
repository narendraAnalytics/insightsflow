"""Clerk webhook receiver — the minimal Phase 1 slice: keep a `users` row in
Neon in sync with Clerk so a signup is visible in the database, without the
full JWT-verified API auth / orgs / roles (that's later Phase 1 scope, see
roadmap.txt). Svix-signed per Clerk's webhook docs; verified before any
event is trusted.
"""

import json

import structlog
from fastapi import APIRouter, Request
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from svix.webhooks import Webhook, WebhookVerificationError

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.models.user import User
from app.db.session import get_sessionmaker

logger = structlog.get_logger("webhooks.clerk")

router = APIRouter(prefix="/webhooks/clerk", tags=["webhooks"])


class WebhookVerificationFailed(AppError):
    status_code = 400
    code = "webhook_verification_failed"


def _verify(payload: bytes, headers: dict[str, str]) -> dict:
    settings = get_settings()
    if not settings.clerk_webhook_secret:
        raise WebhookVerificationFailed("CLERK_WEBHOOK_SECRET is not configured")
    try:
        # svix's verify() only validates the signature (json_parse=False under
        # the hood) and returns None — parse the already-verified payload ourselves.
        Webhook(settings.clerk_webhook_secret).verify(payload, headers)
    except WebhookVerificationError as exc:
        raise WebhookVerificationFailed(str(exc)) from exc
    return json.loads(payload)


def _primary_email(data: dict) -> str | None:
    addresses = data.get("email_addresses") or []
    primary_id = data.get("primary_email_address_id")
    for addr in addresses:
        if addr.get("id") == primary_id:
            return addr.get("email_address")
    return addresses[0].get("email_address") if addresses else None


def _display_name(data: dict) -> str | None:
    parts = [data.get("first_name"), data.get("last_name")]
    name = " ".join(p for p in parts if p)
    return name or None


@router.post("")
async def handle_clerk_webhook(request: Request) -> dict:
    payload = await request.body()
    event = _verify(payload, dict(request.headers))

    event_type = event.get("type")
    data = event.get("data", {})

    if event_type in ("user.created", "user.updated"):
        clerk_user_id = data["id"]
        values = {
            "clerk_user_id": clerk_user_id,
            "email": _primary_email(data),
            "username": data.get("username"),
            "name": _display_name(data),
            "locale": data.get("locale"),
        }
        session_factory = get_sessionmaker()
        async with session_factory() as session:
            stmt = insert(User).values(**values)
            stmt = stmt.on_conflict_do_update(
                index_elements=[User.clerk_user_id],
                set_={k: v for k, v in values.items() if k != "clerk_user_id"},
            )
            await session.execute(stmt)
            await session.commit()
        logger.info("clerk_user_synced", clerk_user_id=clerk_user_id, event_type=event_type)

    elif event_type == "user.deleted":
        clerk_user_id = data.get("id")
        session_factory = get_sessionmaker()
        async with session_factory() as session:
            await session.execute(delete(User).where(User.clerk_user_id == clerk_user_id))
            await session.commit()
        logger.info("clerk_user_deleted", clerk_user_id=clerk_user_id)

    else:
        logger.info("clerk_webhook_ignored", event_type=event_type)

    return {"received": True}
