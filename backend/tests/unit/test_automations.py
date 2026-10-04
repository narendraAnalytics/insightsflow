from datetime import UTC, datetime

import pytest

from app.db.models.automation import Automation
from app.services import automation_service as svc


def utc(y: int, m: int, d: int, h: int, mi: int = 0) -> datetime:
    return datetime(y, m, d, h, mi, tzinfo=UTC)


def test_daily_rolls_to_tomorrow_when_time_passed():
    # 2026-10-05 09:00 IST == 03:30 UTC. At 04:00 UTC (9:30 IST) the next one is tomorrow.
    nxt = svc.next_run_after(utc(2026, 10, 5, 4, 0), "daily", 9, 0)
    assert nxt == utc(2026, 10, 6, 3, 30)


def test_daily_same_day_when_still_ahead():
    nxt = svc.next_run_after(utc(2026, 10, 5, 1, 0), "daily", 9, 0)
    assert nxt == utc(2026, 10, 5, 3, 30)


def test_weekly_picks_next_weekday():
    # 2026-10-05 is a Monday. Weekly on Monday 09:00 IST, asked after it fired -> next Monday.
    nxt = svc.next_run_after(utc(2026, 10, 5, 4, 0), "weekly", 9, 0, weekday=0)
    assert nxt == utc(2026, 10, 12, 3, 30)
    # Friday (4) from Monday is 4 days ahead.
    assert svc.next_run_after(utc(2026, 10, 5, 4, 0), "weekly", 9, 0, weekday=4) == utc(
        2026, 10, 9, 3, 30
    )


def test_monthly_rolls_over_year_end():
    nxt = svc.next_run_after(utc(2026, 12, 20, 0, 0), "monthly", 9, 0, month_day=5)
    assert nxt == utc(2027, 1, 5, 3, 30)


def test_ist_date_boundary():
    # 20:00 UTC on the 5th is already 01:30 IST on the 6th.
    nxt = svc.next_run_after(utc(2026, 10, 5, 20, 0), "daily", 9, 0)
    assert nxt == utc(2026, 10, 6, 3, 30)


def base(**over):
    data = {
        "name": "Weekly sales",
        "question": "Total revenue by region",
        "data_source_ids": ["0b3f1d1e-0000-4000-8000-000000000001"],
        "delivery": {"email": "boss@example.com", "slack": True, "notion": False},
        "frequency": "weekly",
        "weekday": 0,
        "hour": 9,
        "minute": 0,
    }
    data.update(over)
    return data


def test_clean_fields_ok_and_drops_irrelevant_schedule_parts():
    fields = svc.clean_fields(base(month_day=3))
    assert fields["weekday"] == 0 and fields["month_day"] is None
    assert fields["delivery"]["email"] == "boss@example.com"


@pytest.mark.parametrize(
    "over",
    [
        {"name": "  "},
        {"question": "hi"},
        {"data_source_ids": []},
        {"data_source_ids": ["not-a-uuid"]},
        {"delivery": {"email": "a@b.com, c@d.com"}},
        {"frequency": "hourly"},
        {"frequency": "weekly", "weekday": None},
        {"frequency": "monthly", "month_day": 31},
        {"minute": 7},
    ],
)
def test_clean_fields_rejects_bad_input(over):
    with pytest.raises(svc.AutomationInvalid):
        svc.clean_fields(base(**over))


def test_prompt_only_asks_for_chosen_channels():
    a = Automation(
        question="Total revenue",
        delivery={"email": "x@y.com", "slack": True, "notion": False},
    )
    prompt = svc.build_prompt(a)
    assert "draft_email" in prompt and "x@y.com" in prompt
    assert "draft_slack_message" in prompt and "draft_notion_page" not in prompt
    assert "Only draft" in prompt
    assert svc.build_prompt(Automation(question="Q?", delivery={})) == "Q?"


def test_pending_drafts_detection():
    steps = [
        {"id": "a", "draft": {"status": "sent"}},
        {"id": "b", "draft": {"status": "draft"}},
        {"id": "c"},
    ]
    drafts = svc.drafts_of(steps)
    assert [d["step_id"] for d in drafts] == ["a", "b"]
    assert [svc._is_pending(d["draft"]) for d in drafts] == [False, True]


def test_describe_schedule():
    assert svc.describe_schedule("weekly", 9, 0, 0, None) == "Every Monday at 9:00 AM IST"
    assert svc.describe_schedule("daily", 18, 30, None, None) == "Every day at 6:30 PM IST"
    assert (
        svc.describe_schedule("monthly", 9, 0, None, 1) == "On day 1 of every month at 9:00 AM IST"
    )
