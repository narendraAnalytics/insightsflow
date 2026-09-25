"""Dashboard summary: KPI counts, recent activity and connected sheets, all
derived from existing tables (see app/services/dashboard_service.py)."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Principal, get_current_principal
from app.db.session import get_db
from app.services import dashboard_service
from app.services.connection_service import get_or_create_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class StatsOut(BaseModel):
    active_integrations: int
    connected_sheets: int
    connected_tabs: int
    questions_asked: int


class ActivityOut(BaseModel):
    kind: str
    title: str
    detail: str | None
    at: datetime


class SourceOut(BaseModel):
    id: uuid.UUID
    name: str
    tab_title: str
    row_count: int
    synced_at: datetime


class DashboardSummary(BaseModel):
    stats: StatsOut
    activity: list[ActivityOut]
    sources: list[SourceOut]


@router.get("/summary", response_model=DashboardSummary)
async def summary(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> DashboardSummary:
    user = await get_or_create_user(db, principal.user_id)
    stats = await dashboard_service.get_stats(db, user.id)
    events = await dashboard_service.recent_activity(db, user.id)
    sources = await dashboard_service.list_sources(db, user.id)
    return DashboardSummary(
        stats=StatsOut(**stats.__dict__),
        activity=[ActivityOut(**e.__dict__) for e in events],
        sources=[
            SourceOut(
                id=s.id,
                name=s.name,
                tab_title=s.tab_title,
                row_count=s.row_count,
                synced_at=s.synced_at,
            )
            for s in sources
        ],
    )
