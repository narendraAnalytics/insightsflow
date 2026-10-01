"""Gmail OAuth + read access. Reuses the Google OAuth client from sheets.py but
runs its own consent flow (`include_granted_scopes` is off, so the token carries
only Gmail's scopes and Sheets' drive.file grant stays untouched).

Scopes: `gmail.send` (sensitive; sending only ever happens from the user's click
on an email-draft card, never straight from the agent) and `gmail.readonly`, which is a RESTRICTED
scope — fine for the project owner and listed test users, but a public launch
needs Google's restricted-scope verification (incl. a paid security assessment).
Reading is dev-only until that decision is made; see the note in CLAUDE.md.
"""

import base64
import re
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import parseaddr
from html import escape

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

SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"

MAX_MESSAGES = 10
MAX_SUBJECT = 150
MAX_BODY = 5000


class GmailApiError(AppError):
    status_code = 502
    code = "gmail_api_error"


class InvalidEmail(AppError):
    status_code = 400
    code = "invalid_email"


@dataclass
class EmailSummary:
    sender: str
    subject: str
    date: str
    snippet: str
    unread: bool


def has_read_scope(scopes: str) -> bool:
    """`scopes` is the comma-joined string stored on the Connection row."""
    return READONLY_SCOPE in scopes.split(",")


def has_send_scope(scopes: str) -> bool:
    return SEND_SCOPE in scopes.split(",")


_ADDRESS = re.compile(r"^[^@\s<>,;\"']+@[^@\s<>,;\"']+\.[^@\s<>,;\"']+$")


def clean_subject(subject: str) -> str:
    """One line, trimmed, capped — a newline in a header would be header injection."""
    return " ".join(subject.split())[:MAX_SUBJECT]


def clean_body(body: str) -> str:
    return body.replace("\r\n", "\n").strip()[:MAX_BODY]


def parse_recipient(to: str) -> str | None:
    """The bare address if `to` is exactly one valid recipient, else None. Multiple
    recipients are refused on purpose: v1 sends to one person per click."""
    _, address = parseaddr(to.strip())
    if not address or len(address) > 254 or not _ADDRESS.match(address):
        return None
    if any(sep in to for sep in (",", ";")):
        return None
    return address


def validated_fields(to: str, subject: str, body: str) -> tuple[str, str, str]:
    """(recipient address, subject, body), cleaned — or InvalidEmail. Used by both
    immediate and scheduled sends so the same rules apply to each."""
    recipient = parse_recipient(to)
    if recipient is None:
        raise InvalidEmail("Enter exactly one valid email address.")
    subject, body = clean_subject(subject), clean_body(body)
    if not subject or not body:
        raise InvalidEmail("An email needs a subject and a message.")
    return recipient, subject, body


def _html_body(body: str) -> str:
    paragraphs = (p.strip() for p in body.split("\n\n") if p.strip())
    inner = "".join(f"<p>{escape(p).replace(chr(10), '<br>')}</p>" for p in paragraphs)
    return f'<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">{inner}</div>'


def send_message(access_token: str, to: str, subject: str, body: str) -> str:
    """Blocking — call via asyncio.to_thread. Sends one email from the user's own
    Gmail account and returns Gmail's message id. Fields are re-validated here, so
    nothing malformed reaches Gmail whatever the caller did."""
    recipient, subject, body = validated_fields(to, subject, body)

    message = EmailMessage()
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)
    message.add_alternative(_html_body(body), subtype="html")
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    service = build(
        "gmail",
        "v1",
        credentials=sheets.Credentials(token=access_token),
        cache_discovery=False,
    )
    try:
        sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()
    except HttpError as exc:
        status = getattr(exc.resp, "status", 0)
        if status in (401, 403):
            raise GmailApiError(
                "Gmail didn't allow sending. Reconnect Gmail on the Integrations page."
            ) from exc
        raise GmailApiError("Gmail couldn't send the email. Try again.") from exc
    return str(sent.get("id", ""))


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
    newest inbox messages. Only Gmail's own short preview snippet is
    included, never the full body."""
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
                    snippet=msg.get("snippet", ""),
                    unread="UNREAD" in msg.get("labelIds", []),
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
