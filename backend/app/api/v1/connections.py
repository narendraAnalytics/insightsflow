"""Provider connections — Google Sheets first (drive.file OAuth + Picker).
See app/services/connection_service.py for the business logic and
app/core/oauth_state.py for why the callback doesn't need a bearer token.
"""

import uuid
from datetime import datetime

from urllib.parse import quote

import structlog
from fastapi import APIRouter, Depends, Path, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.oauth_state import verify_state
from app.core.security import Principal, get_current_principal
from app.db.models.connection import Connection
from app.db.models.data_source import DataSource
from app.db.session import get_db
from app.integrations import slack
from app.integrations.google import gmail as google_gmail
from app.services import (
    connection_service,
    credit_service,
    data_source_service,
    notion_service,
    slack_service,
)

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/connections", tags=["connections"])


class SetGmailLinkRequest(BaseModel):
    # None unlinks the workspace from any Gmail account.
    gmail_connection_id: uuid.UUID | None = None


class ConnectUrlResponse(BaseModel):
    url: str


class PickerTokenResponse(BaseModel):
    access_token: str
    app_id: str


class AddSourceRequest(BaseModel):
    file_id: str = Field(min_length=10, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")
    # None = the spreadsheet's first tab.
    tab_title: str | None = Field(default=None, max_length=255)
    # Which Google login owns it; None = the default login.
    connection_id: uuid.UUID | None = None


class SheetPreviewResponse(BaseModel):
    headers: list[str]
    rows: list[list[str]]


class TabOut(BaseModel):
    id: int
    title: str


class TabsResponse(BaseModel):
    name: str
    tabs: list[TabOut]


class DataSourceOut(BaseModel):
    id: uuid.UUID
    connection_id: uuid.UUID
    spreadsheet_id: str
    name: str
    tab_title: str
    headers: list[str]
    row_count: int
    synced_at: datetime

    @classmethod
    def from_model(cls, s: DataSource) -> "DataSourceOut":
        return cls(
            id=s.id,
            connection_id=s.connection_id,
            spreadsheet_id=s.external_id,
            name=s.name,
            tab_title=s.tab_title,
            headers=list(s.headers or []),
            row_count=s.row_count,
            synced_at=s.synced_at,
        )


class ConnectionResponse(BaseModel):
    id: uuid.UUID
    provider: str
    status: str
    # Gmail: the account's address. Slack: the workspace name.
    external_account_email: str | None
    can_read_mail: bool
    # Slack only: the default channel for approved posts (None until one is chosen).
    slack_channel_id: str | None = None
    slack_channel_name: str | None = None
    # Notion only: the parent page approved reports are saved under (None until chosen).
    notion_page_id: str | None = None
    notion_page_title: str | None = None
    # Slack/Notion only: the Gmail account (connection id) this workspace belongs to.
    gmail_connection_id: str | None = None
    # Gmail may have several accounts; exactly one is the default (used unless a draft picks).
    is_default: bool = False
    sources: list[DataSourceOut]

    @classmethod
    def from_model(
        cls, c: Connection, sources: list[DataSource], is_default: bool = False
    ) -> "ConnectionResponse":
        cfg = (c.config or {}) if c.provider in ("slack", "notion", "google_sheets") else {}
        return cls(
            id=c.id,
            is_default=is_default,
            provider=c.provider,
            status=c.status,
            external_account_email=c.external_account_email,
            can_read_mail=c.provider == "gmail" and google_gmail.has_read_scope(c.scopes),
            slack_channel_id=cfg.get("channel_id"),
            slack_channel_name=cfg.get("channel_name"),
            notion_page_id=cfg.get("page_id") if c.provider == "notion" else None,
            notion_page_title=cfg.get("page_title") if c.provider == "notion" else None,
            gmail_connection_id=cfg.get(connection_service.GMAIL_LINK_KEY),
            sources=[DataSourceOut.from_model(s) for s in sources],
        )


@router.get("/google/connect-url", response_model=ConnectUrlResponse)
async def google_connect_url(
    # reconnect=true refreshes a login that's already connected; without it the OAuth adds one
    # (up to the cap). Connecting a Google login is free: each sheet tab added is what costs.
    reconnect: bool = Query(default=False),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> ConnectUrlResponse:
    if not reconnect:
        user = await connection_service.get_or_create_user(db, principal.user_id)
        logins = await connection_service.provider_connections(db, user.id, "google_sheets")
        if len(logins) >= connection_service.MAX_ACCOUNTS_PER_PROVIDER:
            raise connection_service.TooManyAccounts(
                f"You can connect up to {connection_service.MAX_ACCOUNTS_PER_PROVIDER} Google "
                "accounts for Sheets. Disconnect one first."
            )
    url = await connection_service.start_google_connect(principal.user_id)
    return ConnectUrlResponse(url=url)


@router.get("/google/callback")
async def google_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    settings = get_settings()
    clerk_user_id, code_verifier = verify_state(state)
    base = f"{settings.frontend_url}/dashboard/integrations"
    try:
        await connection_service.complete_google_connect(db, clerk_user_id, code, code_verifier)
    except connection_service.TooManyAccounts:
        return RedirectResponse(url=f"{base}?sheets_error=limit")
    except Exception as exc:  # noqa: BLE001 - show the user a reason instead of raw JSON
        logger.exception("google_sheets_connect_failed", error_type=type(exc).__name__)
        detail = quote(type(exc).__name__[:60])  # class name only; the message stays in the server log
        return RedirectResponse(url=f"{base}?sheets_error=failed&detail={detail}")
    return RedirectResponse(url=f"{base}?connected=google_sheets")


@router.get("/google/picker-token", response_model=PickerTokenResponse)
async def google_picker_token(
    connection_id: uuid.UUID | None = Query(default=None),  # None = the default login
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> PickerTokenResponse:
    connection = await connection_service.get_connection(
        db, principal.user_id, "google_sheets", connection_id
    )
    access_token = await connection_service.get_valid_access_token(db, connection)
    settings = get_settings()
    # The Picker's setAppId() wants the Drive project number, which is the
    # numeric prefix of a GOOGLE_CLIENT_ID like "123456-abc.apps.googleusercontent.com".
    # Without it, drive.file's per-file access grant on a Picker selection
    # never registers — the file *looks* picked but the backend's token has
    # no real grant to it (a 404 from the Sheets API, not a 403).
    app_id = (settings.google_client_id or "").split("-", 1)[0]
    return PickerTokenResponse(access_token=access_token, app_id=app_id)


SpreadsheetId = Path(min_length=10, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")


@router.get("/google/spreadsheets/{spreadsheet_id}/tabs", response_model=TabsResponse)
async def google_spreadsheet_tabs(
    spreadsheet_id: str = SpreadsheetId,
    connection_id: uuid.UUID | None = Query(default=None),  # None = the default login
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> TabsResponse:
    info = await data_source_service.list_tabs(db, principal.user_id, spreadsheet_id, connection_id)
    return TabsResponse(name=info.name, tabs=[TabOut(id=t.id, title=t.title) for t in info.tabs])


@router.post("/google/sources", response_model=DataSourceOut, status_code=201)
async def google_add_source(
    body: AddSourceRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> DataSourceOut:
    source = await data_source_service.add_source(
        db, principal.user_id, body.file_id, body.tab_title, body.connection_id
    )
    return DataSourceOut.from_model(source)


@router.delete("/google/sources/{source_id}", status_code=204)
async def google_remove_source(
    source_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await data_source_service.remove_source(db, principal.user_id, source_id)


@router.get("/google/sources/{source_id}/preview", response_model=SheetPreviewResponse)
async def google_source_preview(
    source_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SheetPreviewResponse:
    preview = await data_source_service.preview(db, principal.user_id, source_id)
    return SheetPreviewResponse(headers=preview.headers, rows=preview.rows)


@router.get("", response_model=list[ConnectionResponse])
async def list_connections(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[ConnectionResponse]:
    user = await connection_service.get_or_create_user(db, principal.user_id)
    await connection_service.autolink_sheets(db, user.id)
    connections = await connection_service.list_connections(db, principal.user_id)
    out: list[ConnectionResponse] = []
    all_sources: list[DataSource] | None = None
    # Per provider that allows several accounts, the default: the flagged one, else the oldest.
    defaults: dict[str, uuid.UUID] = {}
    for provider in connection_service.MULTI_ACCOUNT_PROVIDERS:
        rows = [c for c in connections if c.provider == provider]
        flagged = next((c for c in rows if connection_service.is_default(c)), None)
        if flagged or rows:
            defaults[provider] = (flagged or rows[0]).id
    for connection in connections:
        # Only Sheets connections own data sources; other providers (Gmail) have none. Each
        # Google login lists just its own tabs.
        sources: list[DataSource] = []
        if connection.provider == "google_sheets":
            if all_sources is None:
                all_sources = await data_source_service.refresh_stale_sources(db, principal.user_id)
            sources = [s for s in all_sources if s.connection_id == connection.id]
        out.append(
            ConnectionResponse.from_model(
                connection,
                sources,
                is_default=defaults.get(connection.provider) == connection.id,
            )
        )
    return out


@router.delete("/google", status_code=204)
async def google_disconnect(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await connection_service.disconnect(db, principal.user_id)


@router.delete("/google/{connection_id}", status_code=204)
async def google_disconnect_one(
    connection_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Disconnects one Google login and its sheet tabs; the default passes to the next one."""
    await connection_service.disconnect(db, principal.user_id, "google_sheets", connection_id)


@router.post("/google/{connection_id}/default", status_code=204)
async def google_make_default(
    connection_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await connection_service.set_default(db, principal.user_id, connection_id, "google_sheets")


@router.put("/google/{connection_id}/gmail", status_code=204)
async def google_set_gmail(
    connection_id: uuid.UUID,
    body: SetGmailLinkRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await connection_service.set_gmail_link(
        db, principal.user_id, "google_sheets", connection_id, body.gmail_connection_id
    )


async def _require_credits_for_new_account(
    db: AsyncSession, clerk_user_id: str, provider: str, noun: str
) -> None:
    """Another account (Gmail) or workspace (Slack) costs credits and is capped; checked
    before OAuth starts."""
    user = await connection_service.get_or_create_user(db, clerk_user_id)
    accounts = await connection_service.provider_connections(db, user.id, provider)
    if len(accounts) >= connection_service.MAX_ACCOUNTS_PER_PROVIDER:
        raise connection_service.TooManyAccounts(
            f"You can connect up to {connection_service.MAX_ACCOUNTS_PER_PROVIDER} {noun}. "
            "Disconnect one first."
        )
    await credit_service.require_credits(db, clerk_user_id, credit_service.CONNECT_COST)


@router.get("/gmail/connect-url", response_model=ConnectUrlResponse)
async def gmail_connect_url(
    # reconnect=true refreshes an account that's already connected (e.g. its login expired)
    # and costs nothing; without it the OAuth adds a new account.
    reconnect: bool = Query(default=False),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> ConnectUrlResponse:
    if not reconnect:
        await _require_credits_for_new_account(db, principal.user_id, "gmail", "Gmail accounts")
    url = await connection_service.start_google_connect(principal.user_id, "gmail")
    return ConnectUrlResponse(url=url)


@router.get("/gmail/callback")
async def gmail_callback(
    code: str | None = Query(default=None),
    state: str = Query(...),
    error: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    settings = get_settings()
    base = f"{settings.frontend_url}/dashboard/integrations"
    # The user clicked "Cancel"/"Deny" on Google's consent screen.
    if error or not code:
        return RedirectResponse(url=f"{base}?gmail_error=denied")
    clerk_user_id, code_verifier = verify_state(state)
    try:
        await connection_service.complete_google_connect(
            db, clerk_user_id, code, code_verifier, "gmail"
        )
    except credit_service.InsufficientCredits:
        return RedirectResponse(url=f"{base}?billing=insufficient")
    except connection_service.TooManyAccounts:
        return RedirectResponse(url=f"{base}?gmail_error=limit")
    return RedirectResponse(url=f"{base}?connected=gmail")


@router.delete("/gmail/{connection_id}", status_code=204)
async def gmail_disconnect(
    connection_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await connection_service.disconnect(db, principal.user_id, "gmail", connection_id)


@router.post("/gmail/{connection_id}/default", status_code=204)
async def gmail_make_default(
    connection_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await connection_service.set_default(db, principal.user_id, connection_id)


class SlackChannelOut(BaseModel):
    id: str
    name: str


class SetSlackChannelRequest(BaseModel):
    channel_id: str = Field(pattern=slack.CHANNEL_ID.pattern)


class SlackChannelChoice(BaseModel):
    channel_id: str
    channel_name: str


@router.get("/slack/connect-url", response_model=ConnectUrlResponse)
async def slack_connect_url(
    # reconnect=true refreshes a workspace that's already connected, for free.
    reconnect: bool = Query(default=False),
    # The Gmail account this workspace belongs to (optional).
    gmail_connection_id: uuid.UUID | None = Query(default=None),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> ConnectUrlResponse:
    if not reconnect:
        await _require_credits_for_new_account(db, principal.user_id, "slack", "Slack workspaces")
    return ConnectUrlResponse(
        url=slack_service.start_connect(principal.user_id, gmail_connection_id)
    )


@router.get("/slack/callback")
async def slack_callback(
    code: str | None = Query(default=None),
    state: str = Query(...),
    error: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    base = f"{get_settings().frontend_url}/dashboard/integrations"
    # The user clicked "Cancel" on Slack's install screen (error=access_denied).
    if error or not code:
        return RedirectResponse(url=f"{base}?slack_error=denied")
    clerk_user_id, cv = verify_state(state)
    try:
        await slack_service.complete_connect(
            db, clerk_user_id, code, connection_service.gmail_link_from_state(cv)
        )
    except credit_service.InsufficientCredits:
        return RedirectResponse(url=f"{base}?billing=insufficient")
    except connection_service.TooManyAccounts:
        return RedirectResponse(url=f"{base}?slack_error=limit")
    return RedirectResponse(url=f"{base}?connected=slack")


@router.get("/slack/{connection_id}/channels", response_model=list[SlackChannelOut])
async def slack_channels(
    connection_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[SlackChannelOut]:
    channels = await slack_service.list_channels(db, principal.user_id, connection_id)
    return [SlackChannelOut(id=c.id, name=c.name) for c in channels]


@router.put("/slack/{connection_id}/channel", response_model=SlackChannelChoice)
async def slack_set_channel(
    connection_id: uuid.UUID,
    body: SetSlackChannelRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SlackChannelChoice:
    config = await slack_service.set_channel(db, principal.user_id, body.channel_id, connection_id)
    return SlackChannelChoice(channel_id=config["channel_id"], channel_name=config["channel_name"])


@router.delete("/slack/{connection_id}", status_code=204)
async def slack_disconnect(
    connection_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await slack_service.disconnect(db, principal.user_id, connection_id)


class SlackTestOut(BaseModel):
    channel_name: str


@router.post("/slack/{connection_id}/test", response_model=SlackTestOut)
async def slack_test_message(
    connection_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SlackTestOut:
    """Posts a fixed 'connected' message to the workspace's channel (the user's click)."""
    result = await slack_service.send_test(db, principal.user_id, connection_id)
    return SlackTestOut(channel_name=result["channel_name"])


@router.post("/slack/{connection_id}/default", status_code=204)
async def slack_make_default(
    connection_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await connection_service.set_default(db, principal.user_id, connection_id, "slack")


@router.put("/slack/{connection_id}/gmail", status_code=204)
async def slack_set_gmail(
    connection_id: uuid.UUID,
    body: SetGmailLinkRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await connection_service.set_gmail_link(
        db, principal.user_id, "slack", connection_id, body.gmail_connection_id
    )


@router.put("/notion/{connection_id}/gmail", status_code=204)
async def notion_set_gmail(
    connection_id: uuid.UUID,
    body: SetGmailLinkRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await connection_service.set_gmail_link(
        db, principal.user_id, "notion", connection_id, body.gmail_connection_id
    )


class NotionPageOut(BaseModel):
    id: str
    title: str


class SetNotionPageRequest(BaseModel):
    page_id: str = Field(min_length=32, max_length=36, pattern=r"^[0-9a-fA-F-]{32,36}$")


class NotionPageChoice(BaseModel):
    page_id: str
    page_title: str


@router.get("/notion/connect-url", response_model=ConnectUrlResponse)
async def notion_connect_url(
    # reconnect=true refreshes a workspace that's already connected, for free.
    reconnect: bool = Query(default=False),
    # The Gmail account this workspace belongs to (optional).
    gmail_connection_id: uuid.UUID | None = Query(default=None),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> ConnectUrlResponse:
    if not reconnect:
        await _require_credits_for_new_account(db, principal.user_id, "notion", "Notion workspaces")
    return ConnectUrlResponse(
        url=notion_service.start_connect(principal.user_id, gmail_connection_id)
    )


@router.get("/notion/callback")
async def notion_callback(
    code: str | None = Query(default=None),
    state: str = Query(...),
    error: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    base = f"{get_settings().frontend_url}/dashboard/integrations"
    # The user clicked "Cancel" on Notion's consent screen (error=access_denied).
    if error or not code:
        return RedirectResponse(url=f"{base}?notion_error=denied")
    clerk_user_id, cv = verify_state(state)
    try:
        await notion_service.complete_connect(
            db, clerk_user_id, code, connection_service.gmail_link_from_state(cv)
        )
    except credit_service.InsufficientCredits:
        return RedirectResponse(url=f"{base}?billing=insufficient")
    except connection_service.TooManyAccounts:
        return RedirectResponse(url=f"{base}?notion_error=limit")
    return RedirectResponse(url=f"{base}?connected=notion")


@router.get("/notion/{connection_id}/pages", response_model=list[NotionPageOut])
async def notion_pages(
    connection_id: uuid.UUID,
    q: str = Query(default="", max_length=100),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[NotionPageOut]:
    pages = await notion_service.list_pages(db, principal.user_id, q, connection_id)
    return [NotionPageOut(id=p.id, title=p.title) for p in pages]


@router.put("/notion/{connection_id}/page", response_model=NotionPageChoice)
async def notion_set_page(
    connection_id: uuid.UUID,
    body: SetNotionPageRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> NotionPageChoice:
    config = await notion_service.set_page(db, principal.user_id, body.page_id, connection_id)
    return NotionPageChoice(page_id=config["page_id"], page_title=config["page_title"])


@router.delete("/notion/{connection_id}", status_code=204)
async def notion_disconnect(
    connection_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await notion_service.disconnect(db, principal.user_id, connection_id)


@router.post("/notion/{connection_id}/default", status_code=204)
async def notion_make_default(
    connection_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await connection_service.set_default(db, principal.user_id, connection_id, "notion")
