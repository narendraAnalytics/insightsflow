"""Machine-to-machine endpoints, called by an external scheduler (not by users, so
no Clerk auth). Protected by a shared secret in the `X-Cron-Secret` header."""

import hmac

import structlog
from fastapi import APIRouter, Header
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.errors import AppError
from app.services import scheduled_email_service

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/internal", tags=["internal"])


class CronDisabled(AppError):
    status_code = 503
    code = "cron_disabled"


class CronForbidden(AppError):
    status_code = 403
    code = "forbidden"


def check_cron_secret(provided: str | None, expected: str | None) -> None:
    """Constant-time comparison. No configured secret means the endpoint is off,
    so a missing env var can never leave it open."""
    if not expected:
        raise CronDisabled("Scheduled sending isn't configured.")
    if not provided or not hmac.compare_digest(provided.encode(), expected.encode()):
        raise CronForbidden("Forbidden")


class RunDueResponse(BaseModel):
    claimed: int
    sent: int
    failed: int
    stale_failed: int


@router.post("/email/run-due", response_model=RunDueResponse)
async def run_due_emails(x_cron_secret: str | None = Header(default=None)) -> RunDueResponse:
    """Sends scheduled emails that are due. Safe to call every minute and to overlap."""
    check_cron_secret(x_cron_secret, get_settings().cron_secret)
    result = await scheduled_email_service.run_due()
    if result["claimed"] or result["stale_failed"]:
        logger.info("email_run_due", **result)
    return RunDueResponse(**result)
