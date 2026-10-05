import uuid
from datetime import UTC, date, datetime

from app.services import delivery_analytics_service as svc

TODAY = date(2026, 10, 5)
CONV = uuid.uuid4()


def utc(d: int, m: int = 10, h: int = 6) -> datetime:
    return datetime(2026, m, d, h, 0, tzinfo=UTC)


def slack(created: datetime, status="sent", sent_at: datetime | None = None, channel="sales"):
    draft = {
        "kind": "slack",
        "channel_name": channel,
        "text": "Weekly   revenue is up",
        "status": status,
    }
    if sent_at:
        draft |= {"sent_at": sent_at.isoformat(), "workspace": "Acme"}
    return svc.DraftRow(created, CONV, draft)


def notion(created: datetime, status="sent", sent_at: datetime | None = None):
    draft = {"kind": "notion", "page_title": "Reports", "title": "Q3 summary", "status": status}
    if sent_at:
        draft |= {"sent_at": sent_at.isoformat(), "workspace": "Acme", "url": "https://n.so/x"}
    return svc.DraftRow(created, CONV, draft)


def test_counts_only_the_requested_kind():
    rows = [slack(utc(4), sent_at=utc(4)), notion(utc(4), sent_at=utc(4))]
    s = svc.summarise("slack", rows, TODAY, 7, [])
    assert s.kpis[0].value == 1 and s.recent[0].destination == "#sales"


def test_sent_vs_waiting_and_approval_rate():
    rows = [
        slack(utc(3), sent_at=utc(3)),
        slack(utc(4), status="draft"),
        slack(utc(5), status="failed"),
        slack(utc(5), sent_at=utc(5), channel="ops"),
    ]
    s = svc.summarise("slack", rows, TODAY, 7, [])
    sent, drafted = s.kpis
    assert (sent.value, drafted.value) == (2, 4)
    assert s.waiting == 2
    assert s.approval_rate == 50.0
    assert {c.label: c.value for c in s.by_destination} == {"#sales": 1, "#ops": 1}


def test_previous_window_drives_the_change():
    # 7-day windows: current = Sep 29..Oct 5, previous = Sep 22..Sep 28.
    rows = [slack(utc(1), sent_at=utc(1)), slack(utc(2), sent_at=utc(2))]
    rows += [slack(utc(25, 9), sent_at=utc(25, 9))]
    s = svc.summarise("slack", rows, TODAY, 7, [])
    sent = s.kpis[0]
    assert (sent.value, sent.previous, sent.change_pct) == (2, 1, 100.0)


def test_daily_series_is_zero_filled_and_uses_ist_days():
    # 20:00 UTC on the 4th is already the 5th in IST.
    rows = [slack(utc(4, h=20), sent_at=utc(4, h=20))]
    s = svc.summarise("slack", rows, TODAY, 7, [])
    assert len(s.daily) == 7
    assert s.daily[-1].date == "2026-10-05" and s.daily[-1].sent == 1
    assert sum(d.sent for d in s.daily) == 1


def test_recent_is_newest_first_with_clean_preview_and_notion_url():
    rows = [notion(utc(2), sent_at=utc(2)), notion(utc(4), sent_at=utc(4))]
    s = svc.summarise("notion", rows, TODAY, 7, [])
    assert s.recent[0].sent_at > s.recent[1].sent_at
    assert s.recent[0].url == "https://n.so/x" and s.recent[0].preview == "Q3 summary"
    sl = svc.summarise("slack", [slack(utc(4), sent_at=utc(4))], TODAY, 7, [])
    assert sl.recent[0].preview == "Weekly revenue is up" and sl.recent[0].url is None


def test_nothing_drafted_means_no_rate_not_zero():
    s = svc.summarise("slack", [], TODAY, 30, [])
    assert s.approval_rate is None and s.waiting == 0 and not s.connected


def email(created: datetime, status="sent", sent_at: datetime | None = None, to="a@x.com"):
    draft = {"to": to, "subject": "Weekly numbers", "body": "hi", "status": status}
    if sent_at:
        draft["sent_at"] = sent_at.isoformat()
    return svc.DraftRow(created, CONV, draft)


def test_gmail_is_the_drafts_without_a_kind():
    rows = [
        email(utc(4), sent_at=utc(4)),
        slack(utc(4), sent_at=utc(4)),
        notion(utc(4), sent_at=utc(4)),
    ]
    g = svc.summarise("gmail", rows, TODAY, 7, [])
    assert g.kpis[0].value == 1 and g.kpis[1].value == 1
    assert g.recent[0].destination == "a@x.com" and g.recent[0].preview == "Weekly numbers"
    # Slack and Notion never count the plain email draft.
    assert svc.summarise("slack", rows, TODAY, 7, []).kpis[1].value == 1


def test_gmail_scheduled_is_separate_from_waiting():
    rows = [
        email(utc(4), status="scheduled"),
        email(utc(4), status="draft"),
        email(utc(5), status="failed"),
        # A scheduled mail that later went out carries no "from", so it is labelled.
        email(utc(3), sent_at=utc(5)),
    ]
    g = svc.summarise("gmail", rows, TODAY, 7, [])
    assert (g.scheduled, g.waiting) == (1, 2)
    assert g.by_workspace[0].label == "Scheduled send"
    assert g.approval_rate == 25.0
