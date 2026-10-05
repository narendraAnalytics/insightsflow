"""Usage analytics for the dashboard's Analytics page (see
app/services/analytics_service.py). Read-only and scoped to the signed-in user."""

import uuid
from dataclasses import asdict
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Principal, get_current_principal
from app.db.session import get_db
from app.services import analytics_service
from app.services.connection_service import get_or_create_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


class KpiOut(BaseModel):
    key: str
    value: int
    previous: int
    change_pct: float | None


class DayOut(BaseModel):
    date: str
    questions: int
    credits: int


class SpendOut(BaseModel):
    reason: str
    credits: int


class RunStatsOut(BaseModel):
    total: int
    by_status: dict[str, int]
    success_rate: float | None


class RecentRunOut(BaseModel):
    id: uuid.UUID
    automation: str
    status: str
    trigger: str
    started_at: datetime
    conversation_id: uuid.UUID | None


class SourceOut(BaseModel):
    name: str
    tab_title: str
    row_count: int


class AnalyticsOut(BaseModel):
    range_days: Literal[7, 30, 90]
    start: str
    end: str
    kpis: list[KpiOut]
    daily: list[DayOut]
    spend_by_reason: list[SpendOut]
    runs: RunStatsOut
    recent_runs: list[RecentRunOut]
    sources: list[SourceOut]


@router.get("", response_model=AnalyticsOut)
async def get_analytics(
    range_days: int = Query(analytics_service.DEFAULT_RANGE, alias="range", ge=1, le=365),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> AnalyticsOut:
    user = await get_or_create_user(db, principal.user_id)
    data = await analytics_service.get_analytics(db, user.id, range_days)
    return AnalyticsOut(**asdict(data))
