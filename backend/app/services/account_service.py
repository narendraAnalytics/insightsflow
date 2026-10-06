"""Your data: export it, delete it, or delete the whole account — no FastAPI imports.

Every query is scoped to the signed-in user. Rows hang off `users` with ON DELETE CASCADE,
so deleting a user removes everything below it; "delete my data" removes the same rows but
keeps the user, the credit balance and the payment history.

Order matters in `delete_account`: the Clerk user is deleted FIRST, so if Clerk refuses
nothing local has changed and the user can simply try again. Provider tokens are collected
before anything is deleted (they're encrypted in the rows) and revoked afterwards, best
effort: a provider being down must never block someone from leaving.
"""

import asyncio
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import structlog
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_token
from app.core.errors import AppError
from app.core.security import clerk_client
from app.db.models.automation import Automation, AutomationRun
from app.db.models.billing import CreditLedger
from app.db.models.chat import ChatConversation, ChatMessage
from app.db.models.connection import Connection
from app.db.models.data_source import DataSource
from app.db.models.document import Document
from app.db.models.scheduled_email import ScheduledEmail
from app.db.models.user import User
from app.integrations import slack
from app.integrations.google import sheets as google
from app.services.connection_service import get_or_create_user

logger = structlog.get_logger(__name__)

CONFIRM_WORD = "DELETE"
GOOGLE_PROVIDERS = {"google_sheets", "gmail"}


class AccountDeletionFailed(AppError):
    status_code = 502
    code = "account_deletion_failed"


@dataclass(frozen=True)
class Grant:
    provider: str
    token: str


def collect_grants(connections: list[Connection]) -> list[Grant]:
    """Decrypts what's needed to revoke each connection. Prefers the refresh token: revoking
    it ends the whole grant. A row that can't be decrypted is skipped, not fatal."""
    grants: list[Grant] = []
    for c in connections:
        try:
            token = decrypt_token(c.refresh_token_enc or c.access_token_enc, c.key_version)
        except Exception:
            logger.warning("account_grant_undecryptable", provider=c.provider)
            continue
        grants.append(Grant(c.provider, token))
    return grants


def _revoke(grant: Grant) -> None:
    # Notion has no revoke call we rely on: the app has to be removed from inside Notion.
    if grant.provider == "slack":
        slack.revoke(grant.token)
    elif grant.provider in GOOGLE_PROVIDERS:
        google.revoke_token(grant.token)


async def revoke_all(grants: list[Grant]) -> None:
    for grant in grants:
        try:
            await asyncio.to_thread(_revoke, grant)
        except Exception:
            logger.warning("account_revoke_failed", provider=grant.provider, exc_info=True)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


async def _user_connections(session: AsyncSession, user_id: uuid.UUID) -> list[Connection]:
    result = await session.execute(select(Connection).where(Connection.user_id == user_id))
    return list(result.scalars())


async def export_data(session: AsyncSession, clerk_user_id: str) -> dict[str, Any]:
    """Everything we hold about the user as plain JSON-able data. OAuth tokens are never
    included, and uploaded documents are listed with their metadata only (their extracted
    rows are large and already visible in the app)."""
    user = await get_or_create_user(session, clerk_user_id)

    async def rows(model: Any, *order: Any) -> list[Any]:
        stmt = select(model).where(model.user_id == user.id).order_by(*order)
        return list((await session.execute(stmt)).scalars())

    connections = await rows(Connection, Connection.created_at)
    sources = await rows(DataSource, DataSource.created_at)
    documents = await rows(Document, Document.created_at)
    automations = await rows(Automation, Automation.created_at)
    runs = await rows(AutomationRun, AutomationRun.started_at)
    scheduled = await rows(ScheduledEmail, ScheduledEmail.created_at)
    ledger = await rows(CreditLedger, CreditLedger.created_at)
    conversations = await rows(ChatConversation, ChatConversation.created_at)

    messages_by_chat: dict[uuid.UUID, list[ChatMessage]] = {}
    if conversations:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.conversation_id.in_([c.id for c in conversations]))
            .order_by(ChatMessage.created_at)
        )
        for m in (await session.execute(stmt)).scalars():
            messages_by_chat.setdefault(m.conversation_id, []).append(m)

    return {
        "exported_at": datetime.now(UTC).isoformat(),
        "note": (
            "OAuth tokens are never exported. Uploaded files are not kept; documents are "
            "listed with their metadata only."
        ),
        "profile": {
            "email": user.email,
            "name": user.name,
            "username": user.username,
            "created_at": _iso(user.created_at),
        },
        "connections": [
            {
                "provider": c.provider,
                "account": c.external_account_email,
                "status": c.status,
                "scopes": c.scopes,
                "settings": c.config,
                "connected_at": _iso(c.created_at),
            }
            for c in connections
        ],
        "data_sources": [
            {
                "name": s.name,
                "tab": s.tab_title,
                "provider": s.provider,
                "columns": s.headers,
                "row_count": s.row_count,
                "added_at": _iso(s.created_at),
            }
            for s in sources
        ],
        "documents": [
            {
                "filename": d.filename,
                "template": d.template,
                "status": d.status,
                "pages": d.page_count,
                "row_count": d.row_count,
                "uploaded_at": _iso(d.created_at),
            }
            for d in documents
        ],
        "chats": [
            {
                "title": c.title,
                "created_at": _iso(c.created_at),
                "messages": [
                    {
                        "role": m.role,
                        "content": m.content,
                        "status": m.status,
                        "at": _iso(m.created_at),
                    }
                    for m in messages_by_chat.get(c.id, [])
                ],
            }
            for c in conversations
        ],
        "automations": [
            {
                "name": a.name,
                "question": a.question,
                "frequency": a.frequency,
                "delivery": a.delivery,
                "enabled": a.enabled,
                "created_at": _iso(a.created_at),
            }
            for a in automations
        ],
        "automation_runs": [
            {
                "status": r.status,
                "trigger": r.trigger,
                "summary": r.summary,
                "error": r.error,
                "started_at": _iso(r.started_at),
                "finished_at": _iso(r.finished_at),
            }
            for r in runs
        ],
        "scheduled_emails": [
            {
                "to": e.to_address,
                "subject": e.subject,
                "status": e.status,
                "send_at": _iso(e.send_at),
                "sent_at": _iso(e.sent_at),
            }
            for e in scheduled
        ],
        "credit_history": [
            {"change": e.delta, "reason": e.reason, "at": _iso(e.created_at)} for e in ledger
        ],
    }


async def delete_data(session: AsyncSession, clerk_user_id: str) -> dict[str, int]:
    """Removes connections, sheets, documents, chats, automations and scheduled emails but
    keeps the account, credit balance and payment history. Scheduled emails still waiting
    are cancelled by this. Returns what was deleted, by kind."""
    user = await get_or_create_user(session, clerk_user_id)
    grants = collect_grants(await _user_connections(session, user.id))

    counts: dict[str, int] = {}
    counts["data_sources"] = int(
        (
            await session.execute(
                select(func.count()).select_from(DataSource).where(DataSource.user_id == user.id)
            )
        ).scalar_one()
    )
    for label, model in (
        ("scheduled_emails", ScheduledEmail),
        ("automations", Automation),  # runs cascade
        ("chats", ChatConversation),  # messages cascade
        ("documents", Document),
        ("connections", Connection),  # data sources cascade
    ):
        result = await session.execute(delete(model).where(model.user_id == user.id))
        counts[label] = int(getattr(result, "rowcount", 0) or 0)
    await session.commit()
    logger.info("account_data_deleted", user_id=str(user.id), **counts)

    await revoke_all(grants)
    return counts


async def delete_account(session: AsyncSession, clerk_user_id: str) -> None:
    """Deletes the Clerk user, then every row (the user row cascades to all of it, credit
    and payment history included), then revokes provider access."""
    user = await get_or_create_user(session, clerk_user_id)
    grants = collect_grants(await _user_connections(session, user.id))

    try:
        await clerk_client().users.delete_async(user_id=clerk_user_id)
    except Exception as exc:
        if getattr(exc, "status_code", None) != 404:  # already gone is fine
            logger.error("clerk_user_delete_failed", exc_info=True)
            raise AccountDeletionFailed(
                "We couldn't delete your account just now. Nothing was removed; try again."
            ) from exc

    await session.execute(delete(User).where(User.id == user.id))
    await session.commit()
    logger.info("account_deleted", user_id=str(user.id))

    await revoke_all(grants)
