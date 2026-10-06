"""Global search over the signed-in user's sheets, documents and chats (see
app/services/search_service.py). Read-only and free."""

import uuid
from dataclasses import asdict
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Principal, get_current_principal
from app.db.session import get_db
from app.services import search_service
from app.services.connection_service import get_or_create_user

router = APIRouter(prefix="/search", tags=["search"])


class SheetHitOut(BaseModel):
    id: uuid.UUID
    name: str
    tab_title: str
    row_count: int


class DocumentHitOut(BaseModel):
    id: uuid.UUID
    filename: str
    template: str
    status: str
    row_count: int


class ChatHitOut(BaseModel):
    id: uuid.UUID
    title: str
    snippet: str | None
    updated_at: datetime


class SearchOut(BaseModel):
    query: str
    sheets: list[SheetHitOut]
    documents: list[DocumentHitOut]
    chats: list[ChatHitOut]


@router.get("", response_model=SearchOut)
async def search(
    q: str = Query("", max_length=200),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SearchOut:
    user = await get_or_create_user(db, principal.user_id)
    results = await search_service.search(db, user.id, q)
    return SearchOut(**asdict(results))
