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


@dataclass
class SheetMetadata:
    name: str
    headers: list[str]
    row_count: int


def fetch_sheet_metadata(access_token: str, spreadsheet_id: str) -> SheetMetadata:
    """Blocking — call via asyncio.to_thread. One small real read against the
    Sheets API, used to prove the connection actually works (no fabricated
    numbers on the dashboard)."""
    creds = Credentials(token=access_token)
    service = build("sheets", "v4", credentials=creds, cache_discovery=False)

    meta = (
        service.spreadsheets()
        .get(spreadsheetId=spreadsheet_id, fields="properties.title,sheets.properties")
        .execute()
    )
    title = meta.get("properties", {}).get("title", "Untitled spreadsheet")
    first_sheet = meta["sheets"][0]["properties"]
    first_sheet_title = first_sheet["title"]

    # gridProperties.rowCount is the sheet's allocated grid (1000 by default),
    # not how many rows hold data — read the values instead. A bare sheet-title
    # range returns only the used range, so this counts real rows.
    values_resp = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=f"'{first_sheet_title}'")
        .execute()
    )
    values = values_resp.get("values", [])
    headers = _clean_headers(values[0]) if values else []
    row_count = sum(1 for row in values[1:] if _row_has_data(row))

    return SheetMetadata(name=title, headers=headers, row_count=row_count)


def _row_has_data(row: list[str]) -> bool:
    return any(str(cell).strip() for cell in row)


def _clean_headers(headers: list[str]) -> list[str]:
    """Drop trailing blank header cells so stray formatted columns don't
    inflate the column count."""
    end = len(headers)
    while end > 0 and not str(headers[end - 1]).strip():
        end -= 1
    return headers[:end]


@dataclass
class SheetPreview:
    headers: list[str]
    rows: list[list[str]]


def fetch_sheet_preview(access_token: str, spreadsheet_id: str, max_rows: int = 25) -> SheetPreview:
    """Blocking — call via asyncio.to_thread. Real data for the 'view sheet'
    modal — headers plus up to `max_rows` data rows, in reading order."""
    creds = Credentials(token=access_token)
    service = build("sheets", "v4", credentials=creds, cache_discovery=False)

    meta = (
        service.spreadsheets()
        .get(spreadsheetId=spreadsheet_id, fields="sheets.properties")
        .execute()
    )
    first_sheet_title = meta["sheets"][0]["properties"]["title"]

    # +1 for the header row itself.
    data_range = f"'{first_sheet_title}'!1:{max_rows + 1}"
    values_resp = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=data_range)
        .execute()
    )
    values = values_resp.get("values", [])
    if not values:
        return SheetPreview(headers=[], rows=[])

    headers = _clean_headers(values[0])
    rows = [row[: len(headers)] for row in values[1:] if _row_has_data(row)]
    # Sheets API drops trailing empty cells per row — pad so every row lines
    # up with the header count for a clean table render.
    padded_rows = [row + [""] * max(0, len(headers) - len(row)) for row in rows]
    return SheetPreview(headers=headers, rows=padded_rows)
