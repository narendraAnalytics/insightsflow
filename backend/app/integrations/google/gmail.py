"""Gmail OAuth + read access. Reuses the Google OAuth client from sheets.py but
runs its own consent flow (`include_granted_scopes` is off, so the token carries
only Gmail's scopes and Sheets' drive.file grant stays untouched).

Scopes: `gmail.send` (sensitive; sending itself is not built yet and must sit
behind the human-approval step) and `gmail.readonly`, which is a RESTRICTED
scope — fine for the project owner and listed test users, but a public launch
needs Google's restricted-scope verification (incl. a paid security assessment).
Reading is dev-only until that decision is made; see the note in CLAUDE.md.
"""

from dataclasses import dataclass

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import get_settings
from app.core.errors import AppError
from app.integrations.google import sheets

READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    READONLY_SCOPE,
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]

MAX_MESSAGES = 10


class GmailApiError(AppError):
    status_code = 502
    code = "gmail_api_error"


@dataclass
class EmailSummary:
    sender: str
    subject: str
    date: str


def has_read_scope(scopes: str) -> bool:
    """`scopes` is the comma-joined string stored on the Connection row."""
    return READONLY_SCOPE in scopes.split(",")


def build_auth_url(state: str, code_verifier: str) -> str:
    return sheets.build_auth_url(
        state,
        code_verifier,
        scopes=SCOPES,
        redirect_uri=get_settings().google_gmail_redirect_uri,
        include_granted_scopes=False,
    )


def exchange_code(code: str, code_verifier: str) -> sheets.GoogleTokens:
    """Blocking — call via asyncio.to_thread."""
    return sheets.exchange_code(
        code,
        code_verifier,
        scopes=SCOPES,
        redirect_uri=get_settings().google_gmail_redirect_uri,
    )


def list_recent_messages(access_token: str, count: int = 5) -> list[EmailSummary]:
    """Blocking — call via asyncio.to_thread. Sender, subject and date of the
    newest inbox messages. Bodies and snippets are deliberately not fetched:
    less private data leaves Gmail, and less untrusted text reaches the LLM."""
    count = max(1, min(count, MAX_MESSAGES))
    service = build(
        "gmail",
        "v1",
        credentials=sheets.Credentials(token=access_token),
        cache_discovery=False,
    )
    try:
        listing = (
            service.users()
            .messages()
            .list(userId="me", labelIds=["INBOX"], maxResults=count)
            .execute()
        )
        out: list[EmailSummary] = []
        for ref in listing.get("messages", []):
            msg = (
                service.users()
                .messages()
                .get(
                    userId="me",
                    id=ref["id"],
                    format="metadata",
                    metadataHeaders=["From", "Subject", "Date"],
                )
                .execute()
            )
            headers = {
                h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])
            }
            out.append(
                EmailSummary(
                    sender=headers.get("from", ""),
                    subject=headers.get("subject", "(no subject)"),
                    date=headers.get("date", ""),
                )
            )
        return out
    except HttpError as exc:
        status = getattr(exc.resp, "status", 0)
        if status in (401, 403):
            raise GmailApiError(
                "Gmail didn't allow reading. Reconnect Gmail on the Integrations page."
            ) from exc
        raise GmailApiError("Gmail returned an error. Try again.") from exc
