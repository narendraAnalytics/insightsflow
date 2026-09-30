import json

import pandas as pd

from app.agent.graph import build_system_prompt
from app.agent.tools import build_tools, tool_label
from app.integrations.google import gmail

FRAME = pd.DataFrame({"A": [1, 2]})


def _tools(fetch=None):
    return {t.name: t for t in build_tools(FRAME, fetch)}


def test_email_tool_absent_without_fetcher():
    assert "recent_emails" not in _tools()


def test_email_tool_returns_table_and_clamps_count():
    seen = []

    def fetch(n):
        seen.append(n)
        return [{"sender": "a@x.com", "subject": "Hi", "date": "Mon"}]

    out = json.loads(_tools(fetch)["recent_emails"].invoke({"count": 99}))
    assert seen == [10]
    assert out["table"]["columns"] == ["From", "Subject", "Date"]
    assert out["table"]["rows"] == [["a@x.com", "Hi", "Mon"]]


def test_email_tool_reports_failure_as_error():
    def fetch(n):
        raise RuntimeError("boom")

    out = json.loads(_tools(fetch)["recent_emails"].invoke({}))
    assert "error" in out and "boom" not in out["error"]


def test_prompt_and_label_and_scope():
    assert "recent_emails" in build_system_prompt([], False, mail=True)
    assert "recent_emails" not in build_system_prompt([], False)
    assert tool_label("recent_emails", {"count": 5}) == "Reading your 5 latest emails"
    assert gmail.has_read_scope("openid," + gmail.READONLY_SCOPE)
    assert not gmail.has_read_scope("https://www.googleapis.com/auth/gmail.send")
