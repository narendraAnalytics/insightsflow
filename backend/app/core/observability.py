"""Error tracking. The Sentry SDK reports to whatever `SENTRY_DSN` names — Better Stack's
Sentry-compatible error tracking today, real Sentry or a self-hosted GlitchTip later, with no
code change. No DSN = switched off (local dev, tests).

Privacy is the point of most of this file. This app holds decrypted OAuth tokens in memory,
users' questions and email drafts in request bodies, and OAuth `code`/`state` in callback
URLs, so the SDK is told never to send local variables, request bodies, cookies, query
strings or secret headers. Only the stack trace, the route and our own request id leave."""

import logging
from typing import Any, cast

import sentry_sdk
import structlog
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.scrubber import DEFAULT_DENYLIST, EventScrubber
from sentry_sdk.utils import BadDsn, Dsn

from app.core.config import Settings

logger = structlog.get_logger("observability")

FILTERED = "[Filtered]"

# Headers that must never leave the server (compared lower-case).
SECRET_HEADERS = {
    "authorization",
    "cookie",
    "x-cron-secret",
    "svix-id",
    "svix-signature",
    "x-razorpay-signature",
}

# Extra keys the scrubber blanks anywhere in an event (on top of Sentry's defaults).
EXTRA_DENYLIST = [
    "access_token",
    "refresh_token",
    "id_token",
    "code",
    "state",
    "code_verifier",
    "client_secret",
    "razorpay_signature",
    "cron_secret",
]


# Loggers that only re-log a request crash the SDK already reports as an exception.
REQUEST_CRASH_LOGGERS = {"http", "errors"}


def _strip_query(url: Any) -> Any:
    return url.split("?", 1)[0] if isinstance(url, str) else url


def scrub_event(
    event: dict[str, Any], _hint: dict[str, Any] | None = None
) -> dict[str, Any] | None:
    """before_send / before_send_transaction: drop request data we never want stored, and the
    duplicate "request_failed"/"unhandled_exception" log events of a crash already captured."""
    if event.get("logger") in REQUEST_CRASH_LOGGERS and not event.get("exception"):
        return None
    request = event.get("request")
    if isinstance(request, dict):
        for key in ("data", "cookies"):
            if key in request:
                request[key] = FILTERED
        if request.get("query_string"):
            request["query_string"] = FILTERED
        if "url" in request:
            request["url"] = _strip_query(request["url"])
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = {
                k: (FILTERED if k.lower() in SECRET_HEADERS else v) for k, v in headers.items()
            }

    breadcrumbs = event.get("breadcrumbs")
    values = breadcrumbs.get("values") if isinstance(breadcrumbs, dict) else breadcrumbs
    if isinstance(values, list):
        for crumb in values:
            data = crumb.get("data") if isinstance(crumb, dict) else None
            if isinstance(data, dict) and "url" in data:
                data["url"] = _strip_query(data["url"])
    return event


def init_sentry(settings: Settings, transport: Any = None) -> bool:
    """Start error tracking if a DSN is configured. Returns whether it was started.
    A malformed DSN (e.g. a plain URL pasted by mistake) only logs a warning: error tracking
    must never stop the API from starting."""
    if not settings.sentry_dsn or (settings.app_env == "test" and transport is None):
        return False
    try:
        Dsn(settings.sentry_dsn)  # parse only: no client, no background thread
    except BadDsn as exc:
        logger.warning("sentry_disabled_bad_dsn", reason=str(exc))
        return False
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        release=settings.sentry_release,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size="never",
        event_scrubber=EventScrubber(denylist=DEFAULT_DENYLIST + EXTRA_DENYLIST, recursive=True),
        before_send=cast(Any, scrub_event),  # Sentry types events as a TypedDict
        before_send_transaction=cast(Any, scrub_event),
        # ERROR logs (e.g. a failed background document/automation job) become events;
        # log lines are NOT kept as breadcrumbs, since they can carry account names.
        integrations=[LoggingIntegration(level=None, event_level=logging.ERROR)],
        transport=transport,
    )
    return True
