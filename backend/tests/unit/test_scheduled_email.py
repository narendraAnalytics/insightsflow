from datetime import UTC, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from httpx import AsyncClient

from app.api.v1 import internal
from app.integrations.google import gmail
from app.services import scheduled_email_service as svc

NOW = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)
IST = timezone(timedelta(hours=5, minutes=30))


def test_validate_send_at_accepts_window_and_converts_to_utc():
    # 9:00 AM IST tomorrow == 03:30 UTC
    when = svc.validate_send_at(datetime(2026, 10, 2, 9, 0, tzinfo=IST), NOW)
    assert when == datetime(2026, 10, 2, 3, 30, tzinfo=UTC)
    assert when.utcoffset() == timedelta(0)


@pytest.mark.parametrize(
    "send_at",
    [
        NOW + timedelta(minutes=1),  # too soon
        NOW - timedelta(hours=1),  # the past
        NOW + timedelta(days=7, minutes=1),  # too far (Testing-mode token expiry)
        datetime(2026, 10, 2, 9, 0),  # no timezone: ambiguous, refused
    ],
)
def test_validate_send_at_rejects_bad_times(send_at):
    with pytest.raises(svc.InvalidScheduleTime):
        svc.validate_send_at(send_at, NOW)


def test_validate_send_at_boundaries_are_inclusive():
    assert svc.validate_send_at(NOW + svc.MIN_LEAD, NOW)
    assert svc.validate_send_at(NOW + svc.MAX_LEAD, NOW)


def test_validated_fields_cleans_and_enforces_one_recipient():
    assert gmail.validated_fields("Rahul <r@acme.com>", "Hi\nthere", " Body ") == (
        "r@acme.com",
        "Hi there",
        "Body",
    )
    for to, subject, body in [("a@b.co,c@d.co", "S", "B"), ("x", "S", "B"), ("a@b.co", "", "B")]:
        with pytest.raises(gmail.InvalidEmail):
            gmail.validated_fields(to, subject, body)


def test_check_cron_secret():
    internal.check_cron_secret("s3cret-value", "s3cret-value")  # ok
    with pytest.raises(internal.CronForbidden):
        internal.check_cron_secret("wrong", "s3cret-value")
    with pytest.raises(internal.CronForbidden):
        internal.check_cron_secret(None, "s3cret-value")
    # No configured secret means the endpoint is OFF, even for an empty/absent header.
    for provided in (None, "", "anything"):
        with pytest.raises(internal.CronDisabled):
            internal.check_cron_secret(provided, None)
        with pytest.raises(internal.CronDisabled):
            internal.check_cron_secret(provided, "")


@pytest.mark.asyncio
async def test_run_due_endpoint_is_gated_before_touching_the_db(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    url = "/api/v1/internal/email/run-due"

    monkeypatch.setattr(internal, "get_settings", lambda: SimpleNamespace(cron_secret=None))
    assert (await client.post(url, headers={"X-Cron-Secret": "x"})).status_code == 503

    monkeypatch.setattr(
        internal, "get_settings", lambda: SimpleNamespace(cron_secret="real-secret")
    )
    assert (await client.post(url)).status_code == 403
    assert (await client.post(url, headers={"X-Cron-Secret": "nope"})).status_code == 403
