import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest

from app.core.errors import NotFoundError
from app.integrations import notion
from app.services import connection_service, credit_service, email_service, notion_service

USER = SimpleNamespace(id=uuid.uuid4())
PAGE_A = "a" * 32
PAGE_B = "b" * 32


def _conn(
    workspace_id: str, age_days: int, *, default: bool = False, page: str | None = None
) -> Any:
    config: dict[str, Any] = {"workspace_id": workspace_id}
    if default:
        config["default"] = True
    if page:
        config.update(page_id=page, page_title=f"Page {page[0]}")
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=USER.id,
        provider="notion",
        status="connected",
        external_account_email=f"Workspace {workspace_id}",
        created_at=datetime.now(UTC) - timedelta(days=age_days),
        config=config,
        access_token_enc="x",
        key_version="1",
    )


class FakeSession:
    def __init__(self, rows: list[Any]) -> None:
        self.rows = rows
        self.commits = 0

    async def execute(self, _stmt: object) -> Any:
        ordered = sorted(self.rows, key=lambda c: c.created_at)
        return SimpleNamespace(scalars=lambda: iter(ordered))

    def add(self, row: Any) -> None:
        row.id = uuid.uuid4()
        row.created_at = datetime.now(UTC)
        self.rows.append(row)

    async def delete(self, row: Any) -> None:
        self.rows = [r for r in self.rows if r is not row]

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, _row: Any) -> None:
        return None


class Spend:
    def __init__(self) -> None:
        self.calls: list[int] = []

    async def __call__(self, _session: object, _user_id: object, amount: int, *_a: Any, **_k: Any):
        self.calls.append(amount)


@pytest.fixture
def spend(monkeypatch: pytest.MonkeyPatch) -> Spend:
    async def fake_user(_session: object, _clerk_id: str) -> Any:
        return USER

    spender = Spend()
    monkeypatch.setattr(connection_service, "get_or_create_user", fake_user)
    monkeypatch.setattr(credit_service, "spend", spender)
    return spender


def _install(monkeypatch: pytest.MonkeyPatch, workspace_id: str) -> None:
    monkeypatch.setattr(
        notion,
        "exchange_code",
        lambda _code: notion.NotionInstall(
            access_token="tok",
            refresh_token="ref",
            bot_id="bot",
            workspace_id=workspace_id,
            workspace_name=f"Workspace {workspace_id}",
        ),
    )


async def test_first_workspace_is_default_and_charged(
    monkeypatch: pytest.MonkeyPatch, spend: Spend
):
    _install(monkeypatch, "w1")
    session = FakeSession([])
    conn = await notion_service.complete_connect(session, "u", "code")  # type: ignore[arg-type]
    assert conn.config["default"] is True
    assert spend.calls == [credit_service.CONNECT_COST]


async def test_second_workspace_is_added_and_charged_not_default(
    monkeypatch: pytest.MonkeyPatch, spend: Spend
):
    _install(monkeypatch, "w2")
    first = _conn("w1", 5, default=True, page=PAGE_A)
    session = FakeSession([first])
    conn = await notion_service.complete_connect(session, "u", "code")  # type: ignore[arg-type]
    assert conn is not first
    assert len(session.rows) == 2
    assert not conn.config.get("default")
    assert spend.calls == [credit_service.CONNECT_COST]


async def test_same_workspace_refreshes_free_and_keeps_page_and_default(
    monkeypatch: pytest.MonkeyPatch, spend: Spend
):
    _install(monkeypatch, "w1")
    existing = _conn("w1", 5, default=True, page=PAGE_A)
    session = FakeSession([existing])
    conn = await notion_service.complete_connect(session, "u", "code")  # type: ignore[arg-type]
    assert conn is existing
    assert spend.calls == []
    assert conn.config["page_id"] == PAGE_A
    assert conn.config["default"] is True


async def test_sixth_workspace_is_refused(monkeypatch: pytest.MonkeyPatch, spend: Spend):
    _install(monkeypatch, "w9")
    rows = [_conn(f"w{i}", 10 - i, default=i == 0) for i in range(5)]
    session = FakeSession(rows)
    with pytest.raises(connection_service.TooManyAccounts):
        await notion_service.complete_connect(session, "u", "code")  # type: ignore[arg-type]
    assert spend.calls == []
    assert len(session.rows) == 5


async def test_disconnecting_default_promotes_the_oldest_remaining(spend: Spend):
    a, b = _conn("w1", 9), _conn("w2", 5, default=True)
    session = FakeSession([a, b])
    await notion_service.disconnect(session, "u", b.id)  # type: ignore[arg-type]
    assert a.config["default"] is True
    assert session.rows == [a]


async def test_unknown_workspace_id_is_not_found(spend: Spend):
    session = FakeSession([_conn("w1", 5, default=True)])
    with pytest.raises(NotFoundError):
        await notion_service.disconnect(session, "u", uuid.uuid4())  # type: ignore[arg-type]


async def test_set_default_covers_notion(spend: Spend):
    a, b = _conn("w1", 9, default=True), _conn("w2", 5)
    session = FakeSession([a, b])
    await connection_service.set_default(session, "u", b.id, "notion")  # type: ignore[arg-type]
    assert b.config["default"] is True and a.config["default"] is False


async def test_default_page_reports_the_default_workspace(spend: Spend):
    a, b = _conn("w1", 9, page=PAGE_A), _conn("w2", 5, default=True, page=PAGE_B)
    session = FakeSession([a, b])
    got = await notion_service.default_page(session, "u")  # type: ignore[arg-type]
    assert got == {
        "id": PAGE_B,
        "title": "Page b",
        "connection_id": str(b.id),
        "workspace": "Workspace w2",
    }


def _wire_save(
    monkeypatch: pytest.MonkeyPatch, draft: dict[str, Any]
) -> tuple[list[tuple[str, str]], SimpleNamespace]:
    message = SimpleNamespace(steps=[{"draft": draft}])
    created: list[tuple[str, str]] = []

    async def owned(*_a: Any) -> None:
        return None

    async def locate(*_a: Any) -> Any:
        return message, 0

    async def call(_session: object, _conn: Any, _fn: Any, page_id: str, *_a: Any) -> Any:
        created.append((page_id, _conn.external_account_email))
        return "id", "https://notion.so/new"

    monkeypatch.setattr(notion_service.chat_service, "get_owned_conversation", owned)
    monkeypatch.setattr(email_service, "locate_draft", locate)
    monkeypatch.setattr(notion_service, "_call", call)
    return created, message


def _draft(connection: Any, page: str) -> dict[str, Any]:
    return {
        "kind": "notion",
        "page_id": page,
        "page_title": "Drafted",
        "connection_id": str(connection.id),
        "status": "draft",
    }


async def test_save_uses_the_draft_workspace_and_page_by_default(
    monkeypatch: pytest.MonkeyPatch, spend: Spend
):
    a, b = _conn("w1", 9, page=PAGE_A), _conn("w2", 5, default=True, page=PAGE_B)
    created, message = _wire_save(monkeypatch, _draft(a, PAGE_A))
    session = FakeSession([a, b])
    await notion_service.save_draft(session, "u", uuid.uuid4(), "s", "T", "Body")  # type: ignore[arg-type]
    # The default is w2, but the draft was made for w1: its page goes to w1's workspace.
    assert created == [(PAGE_A, "Workspace w1")]
    assert message.steps[0]["draft"]["connection_id"] == str(a.id)


async def test_save_to_another_workspace_uses_that_workspaces_page(
    monkeypatch: pytest.MonkeyPatch, spend: Spend
):
    a, b = _conn("w1", 9, default=True, page=PAGE_A), _conn("w2", 5, page=PAGE_B)
    created, message = _wire_save(monkeypatch, _draft(a, PAGE_A))
    session = FakeSession([a, b])
    await notion_service.save_draft(session, "u", uuid.uuid4(), "s", "T", "Body", b.id)  # type: ignore[arg-type]
    assert created == [(PAGE_B, "Workspace w2")]
    saved = message.steps[0]["draft"]
    assert saved["page_title"] == "Page b"
    assert saved["workspace"] == "Workspace w2"


async def test_save_to_a_workspace_without_a_page_is_refused(
    monkeypatch: pytest.MonkeyPatch, spend: Spend
):
    a, b = _conn("w1", 9, default=True, page=PAGE_A), _conn("w2", 5)
    created, _ = _wire_save(monkeypatch, _draft(a, PAGE_A))
    session = FakeSession([a, b])
    with pytest.raises(notion_service.NotionNotConnected):
        await notion_service.save_draft(session, "u", uuid.uuid4(), "s", "T", "Body", b.id)  # type: ignore[arg-type]
    assert created == []
