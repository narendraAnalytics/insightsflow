import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pandas as pd
import pytest

from app.agent.graph import build_system_prompt
from app.agent.tools import build_tools, tool_label
from app.core.config import get_settings
from app.core.crypto import decrypt_token, encrypt_token
from app.integrations import notion
from app.services import email_service, notion_service

FRAME = pd.DataFrame({"A": [1, 2]})
PAGE = {"id": "0123456789abcdef0123456789abcdef", "title": "Reports"}
PAGE_ID = "0123456789abcdef0123456789abcdef"


@pytest.fixture
def notion_env(monkeypatch):
    monkeypatch.setenv("NOTION_CLIENT_ID", "cid")
    monkeypatch.setenv("NOTION_CLIENT_SECRET", "shh")
    monkeypatch.setenv("NOTION_REDIRECT_URI", "https://api.example.com/notion/cb")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _resp(payload, status=200):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = payload
    return r


# ---- OAuth ------------------------------------------------------------------------------


def test_auth_url(notion_env):
    url = urlparse(notion.build_auth_url("signed.state"))
    q = parse_qs(url.query)
    assert url.netloc + url.path == "api.notion.com/v1/oauth/authorize"
    assert q["client_id"] == ["cid"] and q["owner"] == ["user"]
    assert q["response_type"] == ["code"] and q["state"] == ["signed.state"]
    assert q["redirect_uri"] == ["https://api.example.com/notion/cb"]


def test_not_configured(monkeypatch):
    for k in ("NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET", "NOTION_REDIRECT_URI"):
        monkeypatch.delenv(k, raising=False)
    get_settings.cache_clear()
    with pytest.raises(notion.NotionNotConfigured):
        notion.build_auth_url("x")


def test_exchange_code_uses_basic_auth_and_returns_both_tokens(notion_env):
    payload = {
        "access_token": "secret_a",
        "refresh_token": "secret_r",
        "bot_id": "b1",
        "workspace_id": "w1",
        "workspace_name": "Acme",
    }
    with patch("app.integrations.notion.httpx.post", return_value=_resp(payload)) as post:
        install = notion.exchange_code("the-code")
    assert post.call_args.kwargs["auth"] == ("cid", "shh")
    assert post.call_args.kwargs["json"]["grant_type"] == "authorization_code"
    assert post.call_args.kwargs["headers"]["Notion-Version"] == get_settings().notion_version
    assert (install.access_token, install.refresh_token, install.workspace_name) == (
        "secret_a",
        "secret_r",
        "Acme",
    )


def test_exchange_rejected(notion_env):
    with patch(
        "app.integrations.notion.httpx.post",
        return_value=_resp({"error": "invalid_grant"}, 400),
    ):
        with pytest.raises(notion.NotionApiError, match="invalid_grant"):
            notion.exchange_code("bad")


def test_refresh_failure_means_reconnect(notion_env):
    with patch(
        "app.integrations.notion.httpx.post", return_value=_resp({"error": "invalid_grant"}, 400)
    ):
        with pytest.raises(notion.NotionNeedsReconnect):
            notion.refresh_tokens("old")


# ---- API calls --------------------------------------------------------------------------


def _page(title="Q3 plan", **extra):
    return {
        "object": "page",
        "id": PAGE_ID,
        "properties": {"Name": {"type": "title", "title": [{"plain_text": title}]}},
        **extra,
    }


def test_search_lists_pages_and_skips_trashed():
    results = [_page("Q3 plan"), _page("Old", in_trash=True), {"object": "data_source"}]
    with patch(
        "app.integrations.notion.httpx.request", return_value=_resp({"results": results})
    ) as req:
        pages = notion.search_pages("tok", " plan ")
    assert [p.title for p in pages] == ["Q3 plan"]
    sent = req.call_args.kwargs["json"]
    assert sent["query"] == "plan" and sent["filter"] == {"property": "object", "value": "page"}


def test_untitled_page_gets_a_name():
    assert notion._page_title({"properties": {}}) == "Untitled"


def test_unauthorized_raises_token_expired():
    with patch(
        "app.integrations.notion.httpx.request",
        return_value=_resp({"code": "unauthorized"}, 401),
    ):
        with pytest.raises(notion.NotionTokenExpired):
            notion.search_pages("tok")


@pytest.mark.parametrize("status,code", [(404, "object_not_found"), (403, "restricted_resource")])
def test_no_access_message_explains_sharing(status, code):
    with patch("app.integrations.notion.httpx.request", return_value=_resp({"code": code}, status)):
        with pytest.raises(notion.NotionApiError, match="Share it with the connection"):
            notion.get_page("tok", PAGE_ID)


def test_create_page_sends_parent_title_and_blocks():
    with patch(
        "app.integrations.notion.httpx.request",
        return_value=_resp({"id": "new", "url": "https://notion.so/new"}),
    ) as req:
        page_id, url = notion.create_page(
            "tok", PAGE_ID, "West leads\nQ3", "Summary line\n\n- West 5,00,000\n## Next\nDone"
        )
    assert (page_id, url) == ("new", "https://notion.so/new")
    body = req.call_args.kwargs["json"]
    assert body["parent"] == {"page_id": PAGE_ID}
    assert body["properties"]["title"]["title"][0]["text"]["content"] == "West leads Q3"
    types = [b["type"] for b in body["children"]]
    assert types == ["paragraph", "bulleted_list_item", "heading_2", "paragraph"]


def test_blocks_are_capped_and_text_chunked():
    many = "\n".join(f"line {i}" for i in range(300))
    assert len(notion.body_to_blocks(many)) == notion.MAX_BLOCKS
    long_block = notion.body_to_blocks("x" * 4500)[0]
    assert [len(t["text"]["content"]) for t in long_block["paragraph"]["rich_text"]] == [
        2000,
        2000,
        500,
    ]


@pytest.mark.parametrize("page_id", ["", "not-a-page", "123"])
def test_create_rejects_bad_parent(page_id):
    with patch("app.integrations.notion.httpx.request") as req:
        with pytest.raises(notion.InvalidNotionPage):
            notion.create_page("tok", page_id, "t", "b")
    req.assert_not_called()


def test_create_rejects_empty_title_or_body():
    with pytest.raises(notion.InvalidNotionPage):
        notion.validated_page(PAGE_ID, "  ", "body")
    with pytest.raises(notion.InvalidNotionPage):
        notion.validated_page(PAGE_ID, "title", "   ")


# ---- service: refresh once on a 401 -------------------------------------------------------


def _connection():
    access, version = encrypt_token("old_access")
    return SimpleNamespace(
        access_token_enc=access,
        refresh_token_enc=encrypt_token("old_refresh")[0],
        key_version=version,
    )


@pytest.mark.asyncio
async def test_401_refreshes_tokens_saves_them_and_retries():
    conn, session = _connection(), MagicMock(commit=AsyncMock())
    calls: list[str] = []

    def fn(token, *args):
        calls.append(token)
        if token == "old_access":
            raise notion.NotionTokenExpired("expired")
        return "ok"

    with patch(
        "app.services.notion_service.notion.refresh_tokens",
        return_value=("new_access", "new_refresh"),
    ):
        assert await notion_service._call(session, conn, fn) == "ok"
    assert calls == ["old_access", "new_access"]
    assert decrypt_token(conn.access_token_enc, conn.key_version) == "new_access"
    assert decrypt_token(conn.refresh_token_enc, conn.key_version) == "new_refresh"
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_401_without_a_refresh_token_means_reconnect():
    conn = _connection()
    conn.refresh_token_enc = None

    def fn(token):
        raise notion.NotionTokenExpired("expired")

    with pytest.raises(notion.NotionNeedsReconnect):
        await notion_service._call(MagicMock(commit=AsyncMock()), conn, fn)


# ---- the agent tool: drafts only, never saves -----------------------------------------------


def _tool(page=PAGE):
    return {t.name: t for t in build_tools(FRAME, notion_page=page)}.get("draft_notion_page")


def test_tool_only_offered_with_a_page():
    assert _tool(None) is None
    assert _tool() is not None


def test_tool_returns_a_draft_for_the_fixed_page():
    out = json.loads(_tool().invoke({"title": "West leads\nQ3", "body": "- West 5,00,000"}))
    assert out["draft"] == {
        "kind": "notion",
        "page_id": PAGE_ID,
        "page_title": "Reports",
        "title": "West leads Q3",
        "body": "- West 5,00,000",
        "status": "draft",
    }
    assert "NOT been saved" in json.dumps(out)


def test_tool_drops_runaway_html_and_rejects_empty():
    out = json.loads(_tool().invoke({"title": "T", "body": "Sales up</span></div>"}))
    assert out["draft"]["body"] == "Sales up"
    assert "error" in json.loads(_tool().invoke({"title": "T", "body": "  "}))


def test_prompt_and_label_mention_notion_only_when_enabled():
    assert "draft_notion_page" in build_system_prompt([], False, notion=True)
    assert "draft_notion_page" not in build_system_prompt([], False)
    assert tool_label("draft_notion_page", {}) == "Drafting your Notion page"


@pytest.mark.parametrize("kind", ["slack", "notion"])
def test_email_path_refuses_other_drafts(kind):
    with pytest.raises(Exception, match="Draft not found"):
        email_service.ensure_unsent({"kind": kind, "status": "draft"})
