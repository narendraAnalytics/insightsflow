"""Error tracking must report crashes WITHOUT leaking tokens, bodies or OAuth params.
The SDK is pointed at an in-memory transport, a real route crashes, and the captured
event is inspected exactly as it would leave the server."""

import json

import pytest
import sentry_sdk
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sentry_sdk.transport import Transport

from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.middleware import RequestContextMiddleware
from app.core.observability import FILTERED, init_sentry, scrub_event

# Built at runtime so the value never appears in source lines the event quotes.
SECRET = "".join(reversed("nekot-terces-repus"))


class CaptureTransport(Transport):
    def __init__(self) -> None:
        super().__init__()
        self.events: list[dict] = []

    def capture_envelope(self, envelope) -> None:  # type: ignore[no-untyped-def]
        for item in envelope.items:
            if item.type == "event":
                self.events.append(json.loads(item.payload.get_bytes()))


@pytest.fixture
def captured():
    settings = get_settings().model_copy(update={"sentry_dsn": "https://pub@example.invalid/1"})
    transport = CaptureTransport()
    assert init_sentry(settings, transport=transport)
    yield transport
    sentry_sdk.init()  # no DSN: switch the SDK back off for other tests


def _app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestContextMiddleware)
    register_exception_handlers(app)

    @app.post("/boom")
    async def boom() -> None:
        access_token = SECRET  # noqa: F841 - a local holding a token must not leave
        raise RuntimeError("kaboom")

    return app


async def test_crash_is_reported_without_secrets(captured):
    transport = ASGITransport(app=_app(), raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post(
            "/boom?code=oauth-code&state=signed-state",
            json={"question": "my private question"},
            headers={"Authorization": "Bearer jwtval-5512", "X-Cron-Secret": "cronval-7731"},
        )
    assert r.status_code == 500
    sentry_sdk.flush()

    # Exactly one report per crash: the duplicate crash log lines are dropped.
    assert len(captured.events) == 1, [e.get("logger") for e in captured.events]
    errors = [e for e in captured.events if e.get("exception")]
    event = errors[0]
    assert event["exception"]["values"][-1]["value"] == "kaboom"
    assert event["tags"]["request_id"]

    raw = json.dumps(captured.events)
    for secret in (
        SECRET,
        "my private question",
        "jwtval-5512",
        "cronval-7731",
        "oauth-code",
        "signed-state",
    ):
        assert secret not in raw, secret


async def test_handled_app_errors_are_not_reported(captured):
    from app.core.errors import AppError

    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/nope")
    async def nope() -> None:
        raise AppError("not allowed")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/nope")
    assert r.status_code < 500
    sentry_sdk.flush()
    assert not [e for e in captured.events if e.get("exception")]


def test_scrub_event_strips_request_data_and_breadcrumb_queries():
    event = {
        "request": {
            "url": "https://api.x/cb?code=1",
            "query_string": "code=1&state=2",
            "data": {"q": "secret"},
            "cookies": {"s": "1"},
            "headers": {"Authorization": "Bearer t", "User-Agent": "ua"},
        },
        "breadcrumbs": {"values": [{"data": {"url": "https://slack.com/api/x?token=abc"}}]},
    }
    out = scrub_event(event)
    req = out["request"]
    assert req["url"] == "https://api.x/cb"
    assert req["query_string"] == FILTERED
    assert req["data"] == FILTERED and req["cookies"] == FILTERED
    assert req["headers"] == {"Authorization": FILTERED, "User-Agent": "ua"}
    assert out["breadcrumbs"]["values"][0]["data"]["url"] == "https://slack.com/api/x"


def test_crash_log_duplicates_are_dropped_but_other_errors_kept():
    assert scrub_event({"logger": "errors", "logentry": {"message": "x"}}) is None
    assert scrub_event({"logger": "documents", "logentry": {"message": "x"}}) is not None
    assert scrub_event({"logger": "errors", "exception": {"values": []}}) is not None


def test_bad_dsn_turns_tracking_off_instead_of_crashing():
    settings = get_settings().model_copy(
        update={"sentry_dsn": "https://insightsflow-zeb7.onrender.com/api/v1/healthz"}
    )
    assert init_sentry(settings, transport=CaptureTransport()) is False


def test_no_dsn_means_off():
    assert init_sentry(get_settings().model_copy(update={"sentry_dsn": None})) is False
