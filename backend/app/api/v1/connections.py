"""Provider connections — Google Sheets first (drive.file OAuth + Picker).
See app/services/connection_service.py for the business logic and
app/core/oauth_state.py for why the callback doesn't need a bearer token.
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import NotFoundError
from app.core.oauth_state import verify_state
from app.core.security import Principal, get_current_principal
from app.db.models.connection import Connection
from app.db.session import get_db
from app.services import connection_service

router = APIRouter(prefix="/connections", tags=["connections"])


class ConnectUrlResponse(BaseModel):
    url: str


class PickerTokenResponse(BaseModel):
    access_token: str
    app_id: str


class SelectSheetRequest(BaseModel):
    file_id: str
    file_name: str


class SheetPreviewResponse(BaseModel):
    headers: list[str]
    rows: list[list[str]]


class ConnectionResponse(BaseModel):
    provider: str
    status: str
    external_account_email: str | None
    google_sheet_id: str | None
    google_sheet_name: str | None
    google_sheet_headers: list[str] | None
    google_sheet_row_count: int | None

    @classmethod
    def from_model(cls, c: Connection) -> "ConnectionResponse":
        return cls(
            provider=c.provider,
            status=c.status,
            external_account_email=c.external_account_email,
            google_sheet_id=c.google_sheet_id,
            google_sheet_name=c.google_sheet_name,
            google_sheet_headers=c.google_sheet_headers,
            google_sheet_row_count=c.google_sheet_row_count,
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


@router.post("/google/select-sheet", response_model=ConnectionResponse)
async def google_select_sheet(
    body: SelectSheetRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> ConnectionResponse:
    connection = await connection_service.select_sheet(
        db, principal.user_id, body.file_id, body.file_name
    )
    return ConnectionResponse.from_model(connection)


@router.get("/google/sheet-preview", response_model=SheetPreviewResponse)
async def google_sheet_preview(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SheetPreviewResponse:
    preview = await connection_service.get_sheet_preview(db, principal.user_id)
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
    return [ConnectionResponse.from_model(connection)]


@router.delete("/google", status_code=204)
async def google_disconnect(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await connection_service.disconnect(db, principal.user_id)
