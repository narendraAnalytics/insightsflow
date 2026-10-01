"""Thin Notion client: OAuth (public connection), refresh, page search, create one page.

Notion calls a public integration a "connection". Each user installs ours into their own
workspace and, in Notion's consent screen, picks which pages we may touch — we can only
see and write under what they shared. Creating a page needs the "insert content"
capability (without it Notion answers 403).

Tokens: the token response carries an `access_token` AND a `refresh_token`. We keep
both and refresh once when a call comes back 401 (`NotionTokenExpired`), so a token that
does expire never forces the user to reconnect.

Saving only ever happens from the user's click on a Notion draft card
(app/services/notion_service.py) — the agent can only draft.

Blocking httpx calls: run via `asyncio.to_thread` from the service layer, like the Google
and Slack clients. No FastAPI/DB imports here.
"""

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings
from app.core.errors import AppError

AUTHORIZE_URL = "https://api.notion.com/v1/oauth/authorize"
API = "https://api.notion.com/v1"

MAX_TITLE = 200
MAX_BODY = 20000
MAX_BLOCKS = 100  # Notion's per-request limit on `children`
MAX_TEXT = 2000  # Notion's limit on one rich-text element
MAX_PAGES = 100
_TIMEOUT = 20.0


class NotionNotConfigured(AppError):
    status_code = 500
    code = "notion_not_configured"


class NotionApiError(AppError):
    status_code = 502
    code = "notion_api_error"


class NotionNeedsReconnect(AppError):
    status_code = 400
    code = "notion_needs_reconnect"


class NotionTokenExpired(AppError):
    """The access token was rejected (401). The service refreshes it and retries once."""

    status_code = 401
    code = "notion_token_expired"


class InvalidNotionPage(AppError):
    status_code = 400
    code = "invalid_notion_page"


@dataclass
class NotionInstall:
    access_token: str
    refresh_token: str | None
    bot_id: str
    workspace_id: str
    workspace_name: str


@dataclass
class NotionPage:
    id: str
    title: str


def _creds() -> tuple[str, str, str]:
    s = get_settings()
    if not (s.notion_client_id and s.notion_client_secret and s.notion_redirect_uri):
        raise NotionNotConfigured(
            "NOTION_CLIENT_ID / NOTION_CLIENT_SECRET / NOTION_REDIRECT_URI must be set"
        )
    return s.notion_client_id, s.notion_client_secret, s.notion_redirect_uri


def build_auth_url(state: str) -> str:
    """No network call. `state` is the signed token from app/core/oauth_state.py."""
    client_id, _, redirect_uri = _creds()
    query = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "owner": "user",
            "state": state,
        }
    )
    return f"{AUTHORIZE_URL}?{query}"


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": get_settings().notion_version,
        "Content-Type": "application/json",
    }


def _request(
    method: str, path: str, token: str, json: dict[str, Any] | None = None
) -> dict[str, Any]:
    try:
        resp = httpx.request(
            method, f"{API}{path}", headers=_headers(token), json=json, timeout=_TIMEOUT
        )
    except httpx.HTTPError as exc:
        raise NotionApiError("Couldn't reach Notion. Try again.") from exc
    try:
        data = resp.json()
    except ValueError as exc:
        raise NotionApiError("Notion returned an unexpected response.") from exc
    if resp.status_code < 400 and isinstance(data, dict):
        return data

    code = str(data.get("code", "")) if isinstance(data, dict) else ""
    if resp.status_code == 401 or code == "unauthorized":
        raise NotionTokenExpired("Notion rejected the access token.")
    if resp.status_code == 429:
        raise NotionApiError("Notion is rate limiting requests. Try again in a minute.")
    if resp.status_code in (403, 404) or code in ("restricted_resource", "object_not_found"):
        raise NotionApiError(
            "InsightFlow can't access that Notion page. Share it with the connection in "
            "Notion (… menu → Connections), or pick another page."
        )
    if code == "validation_error":
        raise NotionApiError("Notion rejected the page content. Shorten or simplify it.")
    raise NotionApiError(f"Notion couldn't complete that request ({code or resp.status_code}).")


def _token_call(body: dict[str, str]) -> dict[str, Any]:
    client_id, client_secret, _ = _creds()
    try:
        resp = httpx.post(
            f"{API}/oauth/token",
            json=body,
            auth=(client_id, client_secret),  # HTTP Basic, as Notion requires
            headers={"Notion-Version": get_settings().notion_version},
            timeout=_TIMEOUT,
        )
    except httpx.HTTPError as exc:
        raise NotionApiError("Couldn't reach Notion. Try again.") from exc
    try:
        data = resp.json()
    except ValueError as exc:
        raise NotionApiError("Notion returned an unexpected response.") from exc
    if resp.status_code >= 400 or not isinstance(data, dict):
        error = data.get("error", resp.status_code) if isinstance(data, dict) else resp.status_code
        raise NotionApiError(f"Notion rejected the connection ({error}).")
    return data


def exchange_code(code: str) -> NotionInstall:
    """Blocking — call via asyncio.to_thread."""
    _, _, redirect_uri = _creds()
    data = _token_call(
        {"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri}
    )
    token = data.get("access_token")
    if not token or not data.get("workspace_id"):
        raise NotionApiError("Notion didn't return an access token. Try connecting again.")
    return NotionInstall(
        access_token=token,
        refresh_token=data.get("refresh_token"),
        bot_id=data.get("bot_id", ""),
        workspace_id=data["workspace_id"],
        workspace_name=data.get("workspace_name") or "Notion workspace",
    )


def refresh_tokens(refresh_token: str) -> tuple[str, str | None]:
    """Blocking. (new access token, new refresh token or None if Notion kept the old one)."""
    try:
        data = _token_call({"grant_type": "refresh_token", "refresh_token": refresh_token})
    except NotionApiError as exc:
        raise NotionNeedsReconnect(
            "Notion needs to be reconnected on the Integrations page."
        ) from exc
    token = data.get("access_token")
    if not token:
        raise NotionNeedsReconnect("Notion needs to be reconnected on the Integrations page.")
    return token, data.get("refresh_token")


def _page_title(page: dict[str, Any]) -> str:
    for prop in (page.get("properties") or {}).values():
        if isinstance(prop, dict) and prop.get("type") == "title":
            text = "".join(t.get("plain_text", "") for t in prop.get("title", []))
            if text.strip():
                return text.strip()
    return "Untitled"


def search_pages(token: str, query: str = "") -> list[NotionPage]:
    """Blocking. Pages the user shared with the connection, most recently edited first.
    Notion's search is title-based and eventually consistent."""
    body: dict[str, Any] = {
        "filter": {"property": "object", "value": "page"},
        "sort": {"direction": "descending", "timestamp": "last_edited_time"},
        "page_size": MAX_PAGES,
    }
    if query.strip():
        body["query"] = query.strip()[:100]
    data = _request("POST", "/search", token, body)
    pages = [
        NotionPage(p["id"], _page_title(p))
        for p in data.get("results", [])
        if p.get("object") == "page" and not p.get("in_trash") and not p.get("archived")
    ]
    return pages


def get_page(token: str, page_id: str) -> NotionPage:
    """Blocking. Proves the connection can reach this page and returns its real title."""
    page_id = page_id.strip()
    if len(page_id.replace("-", "")) != 32 or not page_id.replace("-", "").isalnum():
        raise InvalidNotionPage("Choose a Notion page.")
    data = _request("GET", f"/pages/{page_id}", token)
    if data.get("in_trash") or data.get("archived"):
        raise InvalidNotionPage("That Notion page is in the trash. Pick another one.")
    return NotionPage(str(data.get("id", page_id)), _page_title(data))


# ---- page content ------------------------------------------------------------------------


def clean_title(title: str) -> str:
    """One line, trimmed, capped."""
    return " ".join(title.split())[:MAX_TITLE]


def clean_body(body: str) -> str:
    return body.replace("\r\n", "\n").strip()[:MAX_BODY]


def _rich_text(text: str) -> list[dict[str, Any]]:
    """Split into <= 2000-char elements, Notion's per-element limit."""
    return [
        {"type": "text", "text": {"content": text[i : i + MAX_TEXT]}}
        for i in range(0, len(text), MAX_TEXT)
    ] or [{"type": "text", "text": {"content": ""}}]


def body_to_blocks(body: str) -> list[dict[str, Any]]:
    """Plain text -> Notion blocks. `# ` / `## ` / `### ` -> heading, `- `/`* `/`• ` ->
    bullet, anything else -> paragraph; blank lines separate. Capped at 100 blocks."""
    blocks: list[dict[str, Any]] = []
    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            continue
        kind, text = "paragraph", line
        if line.startswith(("# ", "## ", "### ")):
            kind, text = "heading_2", line.lstrip("#").strip()
        elif line.startswith(("- ", "* ", "• ")):
            kind, text = "bulleted_list_item", line[2:].strip()
        if text:
            blocks.append({"object": "block", "type": kind, kind: {"rich_text": _rich_text(text)}})
        if len(blocks) >= MAX_BLOCKS:
            break
    return blocks


def validated_page(page_id: str, title: str, body: str) -> tuple[str, str, str]:
    page_id = page_id.strip()
    if len(page_id.replace("-", "")) != 32 or not page_id.replace("-", "").isalnum():
        raise InvalidNotionPage("Choose a Notion page to save under.")
    title, body = clean_title(title), clean_body(body)
    if not title or not body:
        raise InvalidNotionPage("A Notion page needs a title and some content.")
    return page_id, title, body


def create_page(token: str, parent_page_id: str, title: str, body: str) -> tuple[str, str]:
    """Blocking. Creates a child page under `parent_page_id` and returns (page id, url).
    Re-validated here so nothing malformed reaches Notion."""
    parent_page_id, title, body = validated_page(parent_page_id, title, body)
    data = _request(
        "POST",
        "/pages",
        token,
        {
            "parent": {"page_id": parent_page_id},
            "properties": {"title": {"title": _rich_text(title)}},
            "children": body_to_blocks(body),
        },
    )
    return str(data.get("id", "")), str(data.get("url", ""))
