import base64
import json
from email import message_from_bytes
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from app.agent.graph import build_system_prompt
from app.agent.tools import build_tools, tool_label
from app.integrations.google import gmail

FRAME = pd.DataFrame({"A": [1, 2]})


def _draft_tool(enabled=True):
    tools = {t.name: t for t in build_tools(FRAME, can_draft_email=enabled)}
    return tools.get("draft_email")


def test_draft_tool_only_offered_when_enabled():
    assert _draft_tool(False) is None
    assert _draft_tool(True) is not None


def test_draft_tool_returns_draft_and_never_sends():
    out = json.loads(
        _draft_tool().invoke(
            {
                "subject": "Q3 sales:\nWest leads",
                "body": "Hi Rahul,\n\nWest led.",
                "to": "rahul@acme.com",
            }
        )
    )
    assert out["draft"] == {
        "to": "rahul@acme.com",
        "subject": "Q3 sales: West leads",  # newline collapsed
        "body": "Hi Rahul,\n\nWest led.",
        "status": "draft",
    }
    assert "NOT been sent" in out["summary"]


@pytest.mark.parametrize("to", ["", "not-an-email", "a@b.com, c@d.com", "x@y"])
def test_draft_tool_drops_missing_or_invalid_recipient(to):
    out = json.loads(_draft_tool().invoke({"subject": "S", "body": "B", "to": to}))
    assert out["draft"]["to"] == ""


def test_draft_tool_strips_runaway_html_from_body():
    out = json.loads(
        _draft_tool().invoke({"subject": "S", "body": "Hi,\n\nWest leads.\n\nBest</span>\n</div>"})
    )
    assert out["draft"]["body"] == "Hi,\n\nWest leads.\n\nBest"
    # A plain "less than" is not a tag and survives.
    out = json.loads(_draft_tool().invoke({"subject": "S", "body": "Sales < 5 units"}))
    assert out["draft"]["body"] == "Sales < 5 units"


def test_draft_tool_needs_subject_and_body():
    out = json.loads(_draft_tool().invoke({"subject": "  ", "body": "B"}))
    assert "error" in out


def test_parse_recipient():
    assert gmail.parse_recipient("Rahul <rahul@acme.com>") == "rahul@acme.com"
    assert gmail.parse_recipient("a@b.co; c@d.co") is None
    assert gmail.parse_recipient("a@b.co,c@d.co") is None
    assert gmail.parse_recipient("") is None


def _send(to="rahul@acme.com", subject="Hello", body="Line one\n\nLine two"):
    service = MagicMock()
    service.users().messages().send().execute.return_value = {"id": "abc123"}
    with patch.object(gmail, "build", return_value=service):
        gmail_id = gmail.send_message("tok", to, subject, body)
    raw = service.users().messages().send.call_args.kwargs["body"]["raw"]
    return gmail_id, message_from_bytes(base64.urlsafe_b64decode(raw))


def test_send_message_builds_plain_and_html_mime():
    gmail_id, msg = _send()
    assert gmail_id == "abc123"
    assert msg["To"] == "rahul@acme.com" and msg["Subject"] == "Hello"
    types = [p.get_content_type() for p in msg.walk() if not p.is_multipart()]
    assert types == ["text/plain", "text/html"]


def test_send_message_escapes_html_in_body():
    _, msg = _send(body="<script>alert(1)</script>")
    html = next(p for p in msg.walk() if p.get_content_type() == "text/html")
    assert "<script>" not in html.get_payload(decode=True).decode()


def test_send_message_rejects_bad_input_before_calling_gmail():
    with patch.object(gmail, "build") as build:
        for to, subject, body in [
            ("nope", "S", "B"),
            ("a@b.co,c@d.co", "S", "B"),
            ("a@b.co", " ", "B"),
            ("a@b.co", "S", " "),
        ]:
            with pytest.raises(gmail.InvalidEmail):
                gmail.send_message("tok", to, subject, body)
        build.assert_not_called()


def test_send_message_subject_newline_cannot_inject_headers():
    _, msg = _send(subject="Hi\nBcc: evil@x.com")
    assert msg["Bcc"] is None
    assert msg["Subject"] == "Hi Bcc: evil@x.com"


def test_prompt_label_and_scope():
    assert "draft_email" in build_system_prompt([], False, mail=True, send=True)
    assert "draft_email" not in build_system_prompt([], False, mail=True)
    assert tool_label("draft_email", {}) == "Drafting your email"
    assert gmail.has_send_scope("openid," + gmail.SEND_SCOPE)
    assert not gmail.has_send_scope(gmail.READONLY_SCOPE)
