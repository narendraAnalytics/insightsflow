from datetime import date

from app.services import analytics_service as svc


def test_only_offered_ranges_are_accepted():
    assert svc.normalise_range(7) == 7
    assert svc.normalise_range(90) == 90
    assert svc.normalise_range(15) == svc.DEFAULT_RANGE
    assert svc.normalise_range(None) == svc.DEFAULT_RANGE


def test_window_is_oldest_first_and_ends_today():
    days = svc.window_days(date(2026, 10, 5), 7)
    assert len(days) == 7
    assert days[0] == date(2026, 9, 29)
    assert days[-1] == date(2026, 10, 5)


def test_previous_window_sits_directly_before_current():
    cur = svc.window_days(date(2026, 10, 5), 7)
    prev = svc.window_days(date(2026, 9, 28), 7)
    assert prev[-1] == date(2026, 9, 28) and cur[0] == date(2026, 9, 29)


def test_pct_change():
    assert svc.pct_change(15, 10) == 50.0
    assert svc.pct_change(5, 10) == -50.0
    assert svc.pct_change(0, 10) == -100.0
    # Nothing to compare against: no percentage, rather than a fake "+inf%".
    assert svc.pct_change(5, 0) is None
    assert svc.pct_change(0, 0) is None


def test_success_rate_counts_everything_but_failed():
    assert svc.success_rate({}) is None
    assert svc.success_rate({"completed": 3, "awaiting_approval": 1}) == 100.0
    assert svc.success_rate({"completed": 3, "failed": 1}) == 75.0
    assert svc.success_rate({"failed": 2}) == 0.0


async def test_endpoint_requires_auth(client):
    r = await client.get("/api/v1/analytics")
    assert r.status_code in (401, 403)
