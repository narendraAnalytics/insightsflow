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
from app.services import analytics_service, data_source_service, sheet_analytics_service
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


# --- Connected sheets ------------------------------------------------------------------


class SheetSourceOut(BaseModel):
    id: uuid.UUID
    name: str
    tab_title: str
    row_count: int


class ColumnOut(BaseModel):
    name: str
    type: str
    missing: int
    distinct: int
    sum: float | None
    mean: float | None
    min: float | None
    max: float | None
    top: list[dict[str, str | int]]


class PointOut(BaseModel):
    label: str
    value: float


class SelectionOut(BaseModel):
    measure: str | None
    agg: str
    group_by: str | None
    date_column: str | None


class SheetProfileOut(BaseModel):
    source: SheetSourceOut
    truncated: bool
    rows: int
    columns: int
    missing_pct: float
    duplicate_rows: int
    column_profiles: list[ColumnOut]
    measures: list[str]
    dimensions: list[str]
    dates: list[str]
    selected: SelectionOut
    total: float | None
    total_words: str | None
    breakdown: list[PointOut]
    trend: list[PointOut]


@router.get("/sheets", response_model=list[SheetSourceOut])
async def list_sheets(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[SheetSourceOut]:
    sources = await data_source_service.list_sources(db, principal.user_id)
    return [
        SheetSourceOut(id=s.id, name=s.name, tab_title=s.tab_title, row_count=s.row_count)
        for s in sources
    ]


@router.get("/sheets/{source_id}", response_model=SheetProfileOut)
async def sheet_profile(
    source_id: uuid.UUID,
    measure: str | None = Query(None, max_length=255),
    agg: Literal["sum", "mean", "count"] = "sum",
    group_by: str | None = Query(None, max_length=255),
    date_column: str | None = Query(None, max_length=255),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> SheetProfileOut:
    """Totals, breakdown and monthly trend of one connected tab, computed with pandas."""
    source, profile, truncated = await sheet_analytics_service.get_profile(
        db, principal.user_id, source_id, measure, agg, group_by, date_column
    )
    return SheetProfileOut(
        source=SheetSourceOut(
            id=source.id, name=source.name, tab_title=source.tab_title, row_count=source.row_count
        ),
        truncated=truncated,
        **asdict(profile),
    )
