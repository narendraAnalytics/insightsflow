"""Thin Slack client: OAuth v2 install, channel listing, posting one message.

Slack installs give a long-lived *bot* token (`xoxb-…`) scoped to one workspace —
no refresh token, no expiry (token rotation is left off). Scopes are the minimum
for "post an approved message to a chosen channel":
  * `channels:read`      list public channels (to pick a default)
  * `chat:write`         post as the bot
  * `chat:write.public`  post in public channels without being invited first

Posting only ever happens from the user's click on a Slack draft card
(app/services/slack_service.py) — the agent can only draft.

Blocking httpx calls: run via `asyncio.to_thread` from the service layer, like
the Google clients. No FastAPI/DB imports here.
"""

import re
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings
from app.core.errors import AppError

AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize"
API = "https://slack.com/api"
SCOPES = ["channels:read", "chat:write", "chat:write.public"]

MAX_MESSAGE = 3000
MAX_CHANNELS = 1000  # 5 pages of 200 — plenty for a picker
_TIMEOUT = 15.0

CHANNEL_ID = re.compile(r"^[CG][A-Z0-9]{2,40}$")


class SlackNotConfigured(AppError):
    status_code = 500
    code = "slack_not_configured"


class SlackApiError(AppError):
    status_code = 502
    code = "slack_api_error"


class SlackNeedsReconnect(AppError):
    status_code = 400
    code = "slack_needs_reconnect"


class InvalidSlackMessage(AppError):
    status_code = 400
    code = "invalid_slack_message"


@dataclass
class SlackInstall:
    bot_token: str
    team_id: str
    team_name: str
    bot_user_id: str
    scopes: list[str]


@dataclass
class SlackChannel:
    id: str
    name: str


def _creds() -> tuple[str, str, str]:
    s = get_settings()
    if not (s.slack_client_id and s.slack_client_secret and s.slack_redirect_uri):
        raise SlackNotConfigured(
            "SLACK_CLIENT_ID / SLACK_CLIENT_SECRET / SLACK_REDIRECT_URI must be set"
        )
    return s.slack_client_id, s.slack_client_secret, s.slack_redirect_uri


def build_auth_url(state: str) -> str:
    """No network call. `state` is the signed token from app/core/oauth_state.py (Slack
    has no PKCE, so the signature is the CSRF protection)."""
    client_id, _, redirect_uri = _creds()
    query = urlencode(
        {
            "client_id": client_id,
            "scope": ",".join(SCOPES),
            "redirect_uri": redirect_uri,
            "state": state,
        }
    )
    return f"{AUTHORIZE_URL}?{query}"


def _call(method: str, token: str | None = None, **params: str | int | bool) -> dict:
    """POST a Slack Web API method. Slack answers HTTP 200 with `ok: false` on errors."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        resp = httpx.post(f"{API}/{method}", data=params, headers=headers, timeout=_TIMEOUT)
    except httpx.HTTPError as exc:
        raise SlackApiError("Couldn't reach Slack. Try again.") from exc
    if resp.status_code == 429:
        raise SlackApiError("Slack is rate limiting requests. Try again in a minute.")
    try:
        data = resp.json()
    except ValueError as exc:
        raise SlackApiError("Slack returned an unexpected response.") from exc
    if not isinstance(data, dict):
        raise SlackApiError("Slack returned an unexpected response.")
    return data


# Slack error codes that mean "this token is no longer usable" -> user must reconnect.
_DEAD_TOKEN = {
    "invalid_auth",
    "not_authed",
    "token_revoked",
    "token_expired",
    "account_inactive",
    "missing_scope",
    "no_permission",
}


def _check(data: dict, action: str) -> dict:
    if data.get("ok"):
        return data
    error = str(data.get("error", "unknown_error"))
    if error in _DEAD_TOKEN:
        raise SlackNeedsReconnect("Slack needs to be reconnected on the Integrations page.")
    raise SlackApiError(f"Slack couldn't {action} ({error}).")


def exchange_code(code: str) -> SlackInstall:
    """Blocking — call via asyncio.to_thread."""
    client_id, client_secret, redirect_uri = _creds()
    data = _call(
        "oauth.v2.access",
        client_id=client_id,
        client_secret=client_secret,
        code=code,
        redirect_uri=redirect_uri,
    )
    if not data.get("ok"):
        raise SlackApiError(f"Slack rejected the connection ({data.get('error', 'unknown')}).")
    token = data.get("access_token")
    team = data.get("team") or {}
    if not token or not team.get("id"):
        raise SlackApiError("Slack didn't return a bot token. Try connecting again.")
    return SlackInstall(
        bot_token=token,
        team_id=team["id"],
        team_name=team.get("name") or "Slack workspace",
        bot_user_id=data.get("bot_user_id", ""),
        scopes=[s for s in str(data.get("scope", "")).split(",") if s],
    )


def list_channels(token: str) -> list[SlackChannel]:
    """Blocking. Public, non-archived channels, alphabetical."""
    out: list[SlackChannel] = []
    cursor = ""
    while len(out) < MAX_CHANNELS:
        params: dict[str, str | int | bool] = {
            "types": "public_channel",
            "exclude_archived": True,
            "limit": 200,
        }
        if cursor:
            params["cursor"] = cursor
        data = _check(_call("conversations.list", token, **params), "list channels")
        out.extend(SlackChannel(c["id"], c["name"]) for c in data.get("channels", []))
        cursor = (data.get("response_metadata") or {}).get("next_cursor", "")
        if not cursor:
            break
    return sorted(out, key=lambda c: c.name)


def clean_message(text: str) -> str:
    """Trimmed and capped. `post_message` escapes it, so a draft can't smuggle in
    <!channel>, <!here> or a link with different display text."""
    return text.replace("\r\n", "\n").strip()[:MAX_MESSAGE]


def escape_text(text: str) -> str:
    """Slack's required escaping (&, <, >) — turns mass-mention syntax into plain text."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def validated_message(channel_id: str, text: str) -> tuple[str, str]:
    if not CHANNEL_ID.match(channel_id):
        raise InvalidSlackMessage("Choose a Slack channel to post to.")
    text = clean_message(text)
    if not text:
        raise InvalidSlackMessage("A Slack message can't be empty.")
    return channel_id, text


_POST_ERRORS = {
    "channel_not_found": "That Slack channel wasn't found. Pick another one.",
    "is_archived": "That Slack channel is archived. Pick another one.",
    "not_in_channel": (
        "InsightFlow isn't in that channel yet. In Slack, open the channel and type "
        "/invite @InsightFlow, or pick another channel."
    ),
    "restricted_action": (
        "Your Slack workspace doesn't allow InsightFlow to post there. "
        "Ask a workspace admin, or pick another channel."
    ),
    "msg_too_long": "That message is too long for Slack.",
}


def post_message(token: str, channel_id: str, text: str) -> str:
    """Blocking. Posts one message as the bot and returns its timestamp (Slack's
    message id). Re-validated here so nothing malformed reaches Slack."""
    channel_id, text = validated_message(channel_id, text)
    data = _call(
        "chat.postMessage",
        token,
        channel=channel_id,
        text=escape_text(text),
        parse="none",
        unfurl_links=False,
        unfurl_media=False,
    )
    if not data.get("ok"):
        error = str(data.get("error", "unknown_error"))
        if error in _POST_ERRORS:
            raise SlackApiError(_POST_ERRORS[error])
        _check(data, "post the message")
    return str(data.get("ts", ""))


def revoke(token: str) -> None:
    """Blocking, best effort: tells Slack to invalidate the bot token on disconnect."""
    try:
        _call("auth.revoke", token)
    except AppError:
        pass
