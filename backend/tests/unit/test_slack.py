import json
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pandas as pd
import pytest

from app.agent.graph import build_system_prompt
from app.agent.tools import build_tools, tool_label
from app.core.config import get_settings
from app.integrations import slack

FRAME = pd.DataFrame({"A": [1, 2]})
CHANNEL = {"id": "C0123ABCD", "name": "management"}


@pytest.fixture
def slack_env(monkeypatch):
    monkeypatch.setenv("SLACK_CLIENT_ID", "123.456")
    monkeypatch.setenv("SLACK_CLIENT_SECRET", "shh")
    monkeypatch.setenv("SLACK_REDIRECT_URI", "https://api.example.com/cb")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _reply(payload, status=200):
    resp = MagicMock()
    resp.status_code = status
    resp.json.return_value = payload
    return resp


def test_auth_url_has_scopes_redirect_and_state(slack_env):
    url = urlparse(slack.build_auth_url("signed.state"))
    q = parse_qs(url.query)
    assert url.netloc == "slack.com" and url.path == "/oauth/v2/authorize"
    assert q["client_id"] == ["123.456"]
    assert q["scope"] == ["channels:read,chat:write,chat:write.public"]
    assert q["redirect_uri"] == ["https://api.example.com/cb"]
    assert q["state"] == ["signed.state"]


def test_not_configured_is_a_clear_error(monkeypatch):
    for k in ("SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET", "SLACK_REDIRECT_URI"):
        monkeypatch.delenv(k, raising=False)
    get_settings.cache_clear()
    with pytest.raises(slack.SlackNotConfigured):
        slack.build_auth_url("x")


def test_exchange_code_returns_install(slack_env):
    payload = {
        "ok": True,
        "access_token": "xoxb-1",
        "scope": "chat:write,channels:read",
        "bot_user_id": "U1",
        "team": {"id": "T1", "name": "Acme"},
    }
    with patch("app.integrations.slack.httpx.post", return_value=_reply(payload)):
        install = slack.exchange_code("the-code")
    assert (install.bot_token, install.team_id, install.team_name) == ("xoxb-1", "T1", "Acme")
    assert install.scopes == ["chat:write", "channels:read"]


def test_exchange_code_rejected(slack_env):
    with patch(
        "app.integrations.slack.httpx.post",
        return_value=_reply({"ok": False, "error": "invalid_code"}),
    ):
        with pytest.raises(slack.SlackApiError, match="invalid_code"):
            slack.exchange_code("bad")


def test_list_channels_paginates_and_sorts(slack_env):
    pages = [
        _reply(
            {
                "ok": True,
                "channels": [{"id": "C2", "name": "zeta"}],
                "response_metadata": {"next_cursor": "abc"},
            }
        ),
        _reply({"ok": True, "channels": [{"id": "C1", "name": "alpha"}]}),
    ]
    with patch("app.integrations.slack.httpx.post", side_effect=pages):
        names = [c.name for c in slack.list_channels("xoxb-1")]
    assert names == ["alpha", "zeta"]


def test_dead_token_asks_for_reconnect():
    with patch(
        "app.integrations.slack.httpx.post",
        return_value=_reply({"ok": False, "error": "token_revoked"}),
    ):
        with pytest.raises(slack.SlackNeedsReconnect):
            slack.list_channels("xoxb-1")


def test_post_escapes_mass_mentions_and_disables_parsing():
    with patch(
        "app.integrations.slack.httpx.post", return_value=_reply({"ok": True, "ts": "1.2"})
    ) as post:
        ts = slack.post_message("xoxb-1", "C0123ABCD", "Hi <!channel> & <https://x.y|click>")
    assert ts == "1.2"
    sent = post.call_args.kwargs["data"]
    assert sent["text"] == "Hi &lt;!channel&gt; &amp; &lt;https://x.y|click&gt;"
    assert sent["parse"] == "none" and sent["channel"] == "C0123ABCD"
    assert post.call_args.kwargs["headers"] == {"Authorization": "Bearer xoxb-1"}


@pytest.mark.parametrize("channel", ["", "general", "c0123abcd", "C1; DROP", "#general"])
def test_post_rejects_bad_channel_ids(channel):
    with patch("app.integrations.slack.httpx.post") as post:
        with pytest.raises(slack.InvalidSlackMessage):
            slack.post_message("xoxb-1", channel, "hello")
    post.assert_not_called()


def test_post_rejects_empty_and_caps_length():
    with pytest.raises(slack.InvalidSlackMessage):
        slack.validated_message("C0123ABCD", "   \n ")
    _, text = slack.validated_message("C0123ABCD", "x" * 9000)
    assert len(text) == slack.MAX_MESSAGE


def test_post_maps_known_errors_to_friendly_messages():
    with patch(
        "app.integrations.slack.httpx.post",
        return_value=_reply({"ok": False, "error": "not_in_channel"}),
    ):
        with pytest.raises(slack.SlackApiError, match="isn't in that channel"):
            slack.post_message("xoxb-1", "C0123ABCD", "hi")


def test_network_failure_is_a_slack_error():
    import httpx

    with patch("app.integrations.slack.httpx.post", side_effect=httpx.ConnectError("boom")):
        with pytest.raises(slack.SlackApiError):
            slack.list_channels("xoxb-1")


def test_revoke_never_raises():
    with patch("app.integrations.slack.httpx.post", side_effect=RuntimeError):
        with pytest.raises(RuntimeError):  # only AppError is swallowed
            slack.revoke("xoxb-1")
    with patch(
        "app.integrations.slack.httpx.post", return_value=_reply({"ok": False, "error": "x"})
    ):
        slack.revoke("xoxb-1")


# ---- the agent tool: drafts only, never posts ------------------------------------------


def _tool(channel=CHANNEL):
    return {t.name: t for t in build_tools(FRAME, slack_channel=channel)}.get("draft_slack_message")


def test_slack_tool_only_offered_with_a_channel():
    assert _tool(None) is None
    assert _tool() is not None


def test_slack_tool_returns_a_draft_for_the_fixed_channel():
    out = json.loads(_tool().invoke({"text": "West leads\nRevenue 5,00,000"}))
    assert out["draft"] == {
        "kind": "slack",
        "channel_id": "C0123ABCD",
        "channel_name": "management",
        "text": "West leads\nRevenue 5,00,000",
        "status": "draft",
    }
    assert "NOT been posted" in out["summary"] or "NOT been posted" in json.dumps(out)


def test_slack_tool_drops_runaway_html_and_rejects_empty():
    out = json.loads(_tool().invoke({"text": "Sales up</span></div>"}))
    assert out["draft"]["text"] == "Sales up"
    assert "error" in json.loads(_tool().invoke({"text": "  "}))


def test_prompt_and_label_mention_slack_only_when_enabled():
    assert "draft_slack_message" in build_system_prompt([], False, slack=True)
    assert "draft_slack_message" not in build_system_prompt([], False)
    assert tool_label("draft_slack_message", {}) == "Drafting your Slack message"
