"""Automations — scheduled AI reports that wait for the user's approval. Business logic
lives in app/services/automation_service.py; delivery goes through the existing
approval-gated AI Insights endpoints (email / Slack / Notion), never from here."""

import uuid
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Principal, get_current_principal
from app.db.models.automation import Automation, AutomationRun
from app.db.session import get_db
from app.services import automation_service as svc
from app.services.connection_service import get_or_create_user

router = APIRouter(prefix="/automations", tags=["automations"])


class DeliveryIn(BaseModel):
    email: str | None = Field(default=None, max_length=320)
    slack: bool = False
    notion: bool = False


class AutomationIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    question: str = Field(min_length=3, max_length=1000)
    data_source_ids: list[uuid.UUID] = Field(min_length=1, max_length=5)
    gmail_connection_id: uuid.UUID | None = None
    delivery: DeliveryIn = Field(default_factory=DeliveryIn)
    frequency: Literal["daily", "weekly", "monthly"]
    weekday: int | None = Field(default=None, ge=0, le=6)
    month_day: int | None = Field(default=None, ge=1, le=28)
    hour: int = Field(default=9, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)

    def as_data(self) -> dict[str, Any]:
        return self.model_dump(mode="json")


class RunOut(BaseModel):
    id: uuid.UUID
    automation_id: uuid.UUID
    automation_name: str | None = None
    conversation_id: uuid.UUID | None
    status: str
    trigger: str
    summary: str | None
    error: str | None
    started_at: datetime
    finished_at: datetime | None
    # Drafts still to approve (and already handled ones) from the run's chat; each is acted on
    # with the usual /insights/email|slack|notion endpoints using conversation_id + step_id.
    drafts: list[dict[str, Any]] = Field(default_factory=list)


class AutomationOut(BaseModel):
    id: uuid.UUID
    name: str
    question: str
    data_source_ids: list[str]
    gmail_connection_id: uuid.UUID | None
    delivery: dict[str, Any]
    frequency: str
    weekday: int | None
    month_day: int | None
    hour: int
    minute: int
    schedule_text: str
    enabled: bool
    next_run_at: datetime | None
    last_run_at: datetime | None
    last_run: RunOut | None = None


def _run_out(run: AutomationRun, drafts: list[dict[str, Any]], name: str | None = None) -> RunOut:
    return RunOut(
        id=run.id,
        automation_id=run.automation_id,
        automation_name=name,
        conversation_id=run.conversation_id,
        status=run.status,
        trigger=run.trigger,
        summary=run.summary,
        error=run.error,
        started_at=run.started_at,
        finished_at=run.finished_at,
        drafts=drafts,
    )


def _out(a: Automation, last: RunOut | None = None) -> AutomationOut:
    return AutomationOut(
        id=a.id,
        name=a.name,
        question=a.question,
        data_source_ids=[str(i) for i in a.data_source_ids],
        gmail_connection_id=a.gmail_connection_id,
        delivery=a.delivery or {},
        frequency=a.frequency,
        weekday=a.weekday,
        month_day=a.month_day,
        hour=a.hour,
        minute=a.minute,
        schedule_text=svc.describe_schedule(a.frequency, a.hour, a.minute, a.weekday, a.month_day),
        enabled=a.enabled,
        next_run_at=a.next_run_at,
        last_run_at=a.last_run_at,
        last_run=last,
    )


class PreviewOut(BaseModel):
    schedule_text: str
    next_runs: list[datetime]


@router.post("/preview", response_model=PreviewOut)
async def preview_schedule(
    body: AutomationIn, principal: Principal = Depends(get_current_principal)
) -> PreviewOut:
    """The next three run times for a schedule, so the form can show them before saving."""
    fields = svc.clean_fields(body.as_data())
    probe = Automation(**fields)
    return PreviewOut(
        schedule_text=svc.describe_schedule(
            probe.frequency, probe.hour, probe.minute, probe.weekday, probe.month_day
        ),
        next_runs=svc.upcoming(probe),
    )


@router.get("/runs", response_model=list[RunOut])
async def list_runs(
    automation_id: uuid.UUID | None = None,
    limit: int = Query(default=30, ge=1, le=100),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[RunOut]:
    """Recent runs with their drafts — the approval inbox is the ones `awaiting_approval`."""
    runs = await svc.list_runs(db, principal.user_id, automation_id, limit)
    names = {a.id: a.name for a in await svc.list_automations(db, principal.user_id)}
    return [_run_out(r, d, names.get(r.automation_id)) for r, d in runs]


@router.post("/runs/{run_id}/dismiss", status_code=204)
async def dismiss_run(
    run_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await svc.dismiss_run(db, principal.user_id, run_id)


@router.get("", response_model=list[AutomationOut])
async def list_automations(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[AutomationOut]:
    rows = await svc.list_automations(db, principal.user_id)
    user = await get_or_create_user(db, principal.user_id)
    last: dict[uuid.UUID, AutomationRun] = {}
    if rows:
        runs = (
            (
                await db.execute(
                    select(AutomationRun)
                    .where(AutomationRun.user_id == user.id)
                    .order_by(AutomationRun.started_at.desc())
                    .limit(200)
                )
            )
            .scalars()
            .all()
        )
        for r in runs:
            last.setdefault(r.automation_id, r)
    return [_out(a, _run_out(last[a.id], []) if a.id in last else None) for a in rows]


@router.post("", response_model=AutomationOut, status_code=201)
async def create_automation(
    body: AutomationIn,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> AutomationOut:
    return _out(await svc.create_automation(db, principal.user_id, body.as_data()))


@router.put("/{automation_id}", response_model=AutomationOut)
async def update_automation(
    automation_id: uuid.UUID,
    body: AutomationIn,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> AutomationOut:
    return _out(await svc.update_automation(db, principal.user_id, automation_id, body.as_data()))


class EnabledIn(BaseModel):
    enabled: bool


@router.post("/{automation_id}/enabled", response_model=AutomationOut)
async def set_enabled(
    automation_id: uuid.UUID,
    body: EnabledIn,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> AutomationOut:
    return _out(await svc.set_enabled(db, principal.user_id, automation_id, body.enabled))


@router.post("/{automation_id}/run", response_model=RunOut, status_code=202)
async def run_now(
    automation_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> RunOut:
    """Starts a run in the background (poll /automations/runs). It still ends at the
    approval step — nothing is delivered by running."""
    run = await svc.start_manual_run(db, principal.user_id, automation_id)
    return _run_out(run, [])


@router.delete("/{automation_id}", status_code=204)
async def delete_automation(
    automation_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await svc.delete_automation(db, principal.user_id, automation_id)
