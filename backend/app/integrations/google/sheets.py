"""Thin Google OAuth + Sheets/Drive client wrapper (roadmap.txt's
`integrations/` layer — no FastAPI/DB imports, just external API calls).

Scope is `drive.file` (non-sensitive, per roadmap.txt's decision to avoid
Google's sensitive-scope verification delay) plus `userinfo.email`/`openid`
so we can show which Google account is connected. `drive.file` only grants
access to files the user explicitly picks via the Google Picker (frontend)
or creates through this app — it does NOT give a listable view of the
user's whole Drive, by design.

All google-auth-oauthlib / googleapiclient calls are synchronous under the
hood (they use `requests`, not `httpx`) — every function here that talks
to Google is called via `asyncio.to_thread` from the route/service layer.
"""

import secrets
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import get_settings
from app.core.errors import AppError

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]

TOKEN_URI = "https://oauth2.googleapis.com/token"
USERINFO_URI = "https://www.googleapis.com/oauth2/v3/userinfo"


class GoogleOAuthNotConfigured(AppError):
    status_code = 500
    code = "google_oauth_not_configured"


@dataclass
class GoogleTokens:
    access_token: str
    refresh_token: str
    expires_at: datetime
    scopes: list[str]
    email: str | None


def _client_config() -> dict:
    settings = get_settings()
    has_config = (
        settings.google_client_id and settings.google_client_secret and settings.google_redirect_uri
    )
    if not has_config:
        raise GoogleOAuthNotConfigured(
            "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI must be set"
        )
    return {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": TOKEN_URI,
            "redirect_uris": [settings.google_redirect_uri],
        }
    }


def _flow() -> Flow:
    settings = get_settings()
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES)
    flow.redirect_uri = settings.google_redirect_uri
    return flow


def generate_code_verifier() -> str:
    """PKCE code_verifier — Google's OAuth server requires one for web
    clients. Runs synchronously (no network call)."""
    return secrets.token_urlsafe(64)


def build_auth_url(state: str, code_verifier: str) -> str:
    """Runs synchronously (no network call) — safe to call directly.
    `code_verifier` must be the same value passed to `exchange_code` for
    the same flow (see app/core/oauth_state.py for how it survives the
    round trip to Google and back)."""
    flow = _flow()
    flow.code_verifier = code_verifier
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # forces a refresh_token even on a re-connect
        state=state,
    )
    return auth_url


def exchange_code(code: str, code_verifier: str) -> GoogleTokens:
    """Blocking — call via asyncio.to_thread."""
    flow = _flow()
    flow.code_verifier = code_verifier
    flow.fetch_token(code=code)
    creds = flow.credentials

    email = None
    if creds.token:
        try:
            headers = {"Authorization": f"Bearer {creds.token}"}
            resp = httpx.get(USERINFO_URI, headers=headers, timeout=10)
            if resp.status_code == 200:
                email = resp.json().get("email")
        except httpx.HTTPError:
            pass  # non-fatal — connection still succeeds without a known email

    expires_at = creds.expiry or datetime.now(UTC)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    return GoogleTokens(
        access_token=creds.token,
        refresh_token=creds.refresh_token,
        expires_at=expires_at,
        scopes=list(creds.scopes or SCOPES),
        email=email,
    )


def refresh_access_token(refresh_token: str, scopes: list[str]) -> tuple[str, datetime]:
    """Blocking — call via asyncio.to_thread. Returns (access_token, expires_at)."""
    settings = get_settings()
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri=TOKEN_URI,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=scopes,
    )
    creds.refresh(GoogleAuthRequest())
    expires_at = creds.expiry or datetime.now(UTC)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    return creds.token, expires_at


class SheetNotAccessible(AppError):
    """Deleted, unshared, or never granted to this app (drive.file only sees
    files the user picked)."""

    status_code = 404
    code = "sheet_not_accessible"


class GoogleRateLimited(AppError):
    status_code = 429
    code = "google_rate_limited"


class GoogleApiError(AppError):
    status_code = 502
    code = "google_api_error"


def _execute(request):  # noqa: ANN001, ANN202
    """Runs a googleapiclient request, translating HTTP failures into AppErrors
    the API layer can return cleanly instead of a bare 500."""
    try:
        return request.execute()
    except HttpError as exc:
        status = getattr(exc.resp, "status", 0)
        if status in (403, 404):
            raise SheetNotAccessible(
                "We can't open that spreadsheet. It may have been deleted or unshared — "
                "pick it again on the Integrations page."
            ) from exc
        if status == 429:
            raise GoogleRateLimited("Google is rate-limiting requests. Try again shortly.") from exc
        raise GoogleApiError("Google Sheets returned an error. Try again.") from exc


class SheetTabNotFound(AppError):
    status_code = 404
    code = "sheet_tab_not_found"


@dataclass
class SheetTab:
    id: int
    title: str


@dataclass
class SpreadsheetInfo:
    name: str
    tabs: list[SheetTab]


@dataclass
class SheetMetadata:
    name: str
    tab_title: str
    tab_id: int | None
    headers: list[str]
    row_count: int


@dataclass
class SheetPreview:
    headers: list[str]
    rows: list[list[str]]


def _service(access_token: str):  # noqa: ANN202
    creds = Credentials(token=access_token)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _a1(tab_title: str, suffix: str = "") -> str:
    """A1 range for a tab; single quotes inside a title are doubled per the spec."""
    return "'" + tab_title.replace("'", "''") + "'" + suffix


def _row_has_data(row: list[str]) -> bool:
    return any(str(cell).strip() for cell in row)


def _clean_headers(headers: list[str]) -> list[str]:
    """Drop trailing blank header cells so stray formatted columns don't
    inflate the column count."""
    end = len(headers)
    while end > 0 and not str(headers[end - 1]).strip():
        end -= 1
    return headers[:end]


def get_spreadsheet_info(access_token: str, spreadsheet_id: str) -> SpreadsheetInfo:
    """Blocking — call via asyncio.to_thread. Name + tabs of a spreadsheet the
    user has granted access to (drive.file grants the whole spreadsheet)."""
    meta = _execute(
        _service(access_token)
        .spreadsheets()
        .get(
            spreadsheetId=spreadsheet_id,
            fields="properties.title,sheets.properties(sheetId,title,index)",
        )
    )
    tabs = [
        SheetTab(id=s["properties"]["sheetId"], title=s["properties"]["title"])
        for s in meta.get("sheets", [])
    ]
    return SpreadsheetInfo(name=meta.get("properties", {}).get("title", "Untitled"), tabs=tabs)


def _resolve_tab(info: SpreadsheetInfo, tab_title: str | None) -> SheetTab:
    if not info.tabs:
        raise SheetTabNotFound("This spreadsheet has no tabs")
    if not tab_title:  # None, or '' = legacy 'first tab, not yet resolved'
        return info.tabs[0]
    for tab in info.tabs:
        if tab.title == tab_title:
            return tab
    raise SheetTabNotFound(f"No tab named '{tab_title}' in this spreadsheet")


def fetch_sheet_metadata(
    access_token: str, spreadsheet_id: str, tab_title: str | None = None
) -> SheetMetadata:
    """Blocking — call via asyncio.to_thread. Reads the real values of one tab
    (first tab when `tab_title` is None) and counts only rows that hold data —
    the sheet's allocated grid (1000 rows by default) is not a row count."""
    info = get_spreadsheet_info(access_token, spreadsheet_id)
    tab = _resolve_tab(info, tab_title)
    values = _execute(
        _service(access_token)
        .spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=_a1(tab.title))
    ).get("values", [])
    headers = _clean_headers(values[0]) if values else []
    row_count = sum(1 for row in values[1:] if _row_has_data(row))
    return SheetMetadata(
        name=info.name, tab_title=tab.title, tab_id=tab.id, headers=headers, row_count=row_count
    )


def fetch_sheet_preview(
    access_token: str, spreadsheet_id: str, tab_title: str | None = None, max_rows: int = 25
) -> SheetPreview:
    """Blocking — call via asyncio.to_thread. Headers plus up to `max_rows`
    non-blank data rows of one tab, in reading order."""
    info = get_spreadsheet_info(access_token, spreadsheet_id)
    tab = _resolve_tab(info, tab_title)
    # +1 for the header row itself.
    values = _execute(
        _service(access_token)
        .spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=_a1(tab.title, f"!1:{max_rows + 1}"))
    ).get("values", [])
    if not values:
        return SheetPreview(headers=[], rows=[])

    headers = _clean_headers(values[0])
    rows = [row[: len(headers)] for row in values[1:] if _row_has_data(row)]
    # Sheets API drops trailing empty cells per row — pad so every row lines
    # up with the header count for a clean table render.
    padded = [row + [""] * max(0, len(headers) - len(row)) for row in rows]
    return SheetPreview(headers=headers, rows=padded)
