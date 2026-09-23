"""Provider connections — Google Sheets first (drive.file OAuth + Picker).
See app/services/connection_service.py for the business logic and
app/core/oauth_state.py for why the callback doesn't need a bearer token.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Path, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import NotFoundError
from app.core.oauth_state import verify_state
from app.core.security import Principal, get_current_principal
from app.db.models.connection import Connection
from app.db.models.data_source import DataSource
from app.db.session import get_db
from app.services import connection_service, data_source_service

router = APIRouter(prefix="/connections", tags=["connections"])


class ConnectUrlResponse(BaseModel):
    url: str


class PickerTokenResponse(BaseModel):
    access_token: str
    app_id: str


class AddSourceRequest(BaseModel):
    file_id: str = Field(min_length=10, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")
    # None = the spreadsheet's first tab.
    tab_title: str | None = Field(default=None, max_length=255)


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
            spreadsheet_id=s.external_id,
            name=s.name,
            tab_title=s.tab_title,
            headers=list(s.headers or []),
            row_count=s.row_count,
            synced_at=s.synced_at,
        )


class ConnectionResponse(BaseModel):
    provider: str
    status: str
    external_account_email: str | None
    sources: list[DataSourceOut]

    @classmethod
    def from_model(cls, c: Connection, sources: list[DataSource]) -> "ConnectionResponse":
        return cls(
            provider=c.provider,
            status=c.status,
            external_account_email=c.external_account_email,
            sources=[DataSourceOut.from_model(s) for s in sources],
        )


@router.get("/google/connect-url", response_model=ConnectUrlResponse)
async def google_connect_url(
    principal: Principal = Depends(get_current_principal),
) -> ConnectUrlResponse:
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
    await connection_service.complete_google_connect(db, clerk_user_id, code, code_verifier)
    redirect_url = f"{settings.frontend_url}/dashboard/integrations?connected=google_sheets"
    return RedirectResponse(url=redirect_url)


@router.get("/google/picker-token", response_model=PickerTokenResponse)
async def google_picker_token(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> PickerTokenResponse:
    connection = await connection_service.get_connection(db, principal.user_id)
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
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> TabsResponse:
    info = await data_source_service.list_tabs(db, principal.user_id, spreadsheet_id)
    return TabsResponse(name=info.name, tabs=[TabOut(id=t.id, title=t.title) for t in info.tabs])


@router.post("/google/sources", response_model=DataSourceOut, status_code=201)
async def google_add_source(
    body: AddSourceRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> DataSourceOut:
    source = await data_source_service.add_source(
        db, principal.user_id, body.file_id, body.tab_title
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
    try:
        connection = await connection_service.get_connection(db, principal.user_id)
    except NotFoundError:
        return []
    sources = await data_source_service.refresh_stale_sources(db, principal.user_id)
    return [ConnectionResponse.from_model(connection, sources)]


@router.delete("/google", status_code=204)
async def google_disconnect(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await connection_service.disconnect(db, principal.user_id)
