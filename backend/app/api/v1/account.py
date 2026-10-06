"""Account and privacy: download your data, delete your data, delete your account.

Both deletions need the caller to send the word DELETE: the UI asks the user to type it,
and the API checks it again so a stray request can't wipe an account."""

from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import Principal, get_current_principal
from app.db.session import get_db
from app.services import account_service

router = APIRouter(prefix="/account", tags=["account"])


class ConfirmRequest(BaseModel):
    confirm: str


class ConfirmationRequired(AppError):
    status_code = 400
    code = "confirmation_required"


class DeleteDataResponse(BaseModel):
    deleted: dict[str, int]


def require_confirm(body: ConfirmRequest) -> None:
    if body.confirm.strip() != account_service.CONFIRM_WORD:
        raise ConfirmationRequired(f"Type {account_service.CONFIRM_WORD} to confirm.")


@router.get("/export")
async def export(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    data = await account_service.export_data(db, principal.user_id)
    return JSONResponse(
        jsonable_encoder(data),
        headers={
            "Content-Disposition": 'attachment; filename="insightflow-data.json"',
            "Cache-Control": "no-store",
        },
    )


@router.post("/delete-data", response_model=DeleteDataResponse)
async def delete_data(
    body: ConfirmRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> DeleteDataResponse:
    require_confirm(body)
    return DeleteDataResponse(deleted=await account_service.delete_data(db, principal.user_id))


@router.post("/delete", status_code=204)
async def delete_account(
    body: ConfirmRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    require_confirm(body)
    await account_service.delete_account(db, principal.user_id)
