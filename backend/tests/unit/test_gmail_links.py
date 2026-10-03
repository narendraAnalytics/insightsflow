import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest

from app.core.errors import NotFoundError
from app.services import connection_service, notion_service, slack_service

USER = SimpleNamespace(id=uuid.uuid4())


def _conn(
    provider: str,
    age_days: int,
    *,
    gmail: uuid.UUID | None = None,
    default: bool = False,
    ready: bool = True,
    name: str = "x",
) -> Any:
    config: dict[str, Any] = {}
    if default:
        config["default"] = True
    if gmail:
        config["gmail_connection_id"] = str(gmail)
    if ready:
        config.update(channel_id=f"C{name}", channel_name=name, page_id=name * 32, page_title=name)
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=USER.id,
        provider=provider,
        status="connected",
        external_account_email=f"ws-{name}",
        created_at=datetime.now(UTC) - timedelta(days=age_days),
        config=config,
    )


class FakeSession:
    """Rows of ALL providers; `execute` can't see the WHERE, so tests give it one provider."""

    def __init__(self, rows: list[Any]) -> None:
        self.rows = rows
        self.commits = 0

    async def execute(self, _stmt: object) -> Any:
        ordered = sorted(self.rows, key=lambda c: c.created_at)
        return SimpleNamespace(scalars=lambda: iter(ordered))

    async def commit(self) -> None:
        self.commits += 1


@pytest.fixture(autouse=True)
def _user(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_user(_session: object, _clerk_id: str) -> Any:
        return USER

    monkeypatch.setattr(connection_service, "get_or_create_user", fake_user)


G1, G2 = uuid.uuid4(), uuid.uuid4()


def test_for_gmail_returns_only_that_gmails_workspaces():
    a, b, c = (
        _conn("slack", 9, gmail=G1, name="a"),
        _conn("slack", 5, gmail=G2, name="b"),
        _conn("slack", 1, gmail=G1, name="c"),
    )
    assert connection_service.for_gmail([a, b, c], G1) == [a, c]
    assert connection_service.for_gmail([a, b, c], G2) == [b]
    assert connection_service.for_gmail([a, b, c], uuid.uuid4()) == []


def test_for_gmail_with_no_links_anywhere_returns_everything():
    a, b = _conn("slack", 9, name="a"), _conn("slack", 5, name="b")
    assert connection_service.for_gmail([a, b], G1) == [a, b]


def test_state_round_trip_and_garbage():
    assert connection_service.gmail_link_from_state(connection_service.gmail_link_state(G1)) == G1
    assert (
        connection_service.gmail_link_from_state(connection_service.gmail_link_state(None)) is None
    )
    assert connection_service.gmail_link_from_state("gmail:not-a-uuid") is None


async def test_slack_channel_follows_the_chats_gmail():
    a = _conn("slack", 9, gmail=G1, default=True, name="a")
    b = _conn("slack", 5, gmail=G2, name="b")
    session = FakeSession([a, b])
    got = await slack_service.default_channel(session, "u", G2)  # type: ignore[arg-type]
    assert got == {"id": "Cb", "name": "b"}
    got = await slack_service.default_channel(session, "u", G1)  # type: ignore[arg-type]
    assert got == {"id": "Ca", "name": "a"}


async def test_slack_gmail_with_no_workspace_gets_no_channel():
    session = FakeSession([_conn("slack", 9, gmail=G1, name="a")])
    assert await slack_service.default_channel(session, "u", G2) is None  # type: ignore[arg-type]


async def test_notion_page_follows_the_chats_gmail():
    a = _conn("notion", 9, gmail=G1, default=True, name="a")
    b = _conn("notion", 5, gmail=G2, name="b")
    session = FakeSession([a, b])
    got = await notion_service.default_page(session, "u", G2)  # type: ignore[arg-type]
    assert got is not None
    assert got["title"] == "b"
    assert got["connection_id"] == str(b.id)


async def test_set_gmail_link_moves_and_clears(monkeypatch: pytest.MonkeyPatch):
    gmail = SimpleNamespace(
        id=G1, user_id=USER.id, provider="gmail", config={}, created_at=datetime.now(UTC)
    )
    ws = _conn("slack", 5, name="a", default=True)

    async def valid(_s: object, _u: object, gid: uuid.UUID | None) -> str | None:
        return str(gid) if gid == gmail.id else None

    async def get(_s: object, _c: str, _p: str, _i: uuid.UUID) -> Any:
        return ws

    monkeypatch.setattr(connection_service, "valid_gmail_link", valid)
    monkeypatch.setattr(connection_service, "get_connection", get)
    session = FakeSession([])
    await connection_service.set_gmail_link(session, "u", "slack", ws.id, G1)  # type: ignore[arg-type]
    assert ws.config["gmail_connection_id"] == str(G1)
    assert ws.config["default"] is True  # other settings stay
    await connection_service.set_gmail_link(session, "u", "slack", ws.id, None)  # type: ignore[arg-type]
    assert "gmail_connection_id" not in ws.config
    with pytest.raises(NotFoundError):
        await connection_service.set_gmail_link(session, "u", "slack", ws.id, uuid.uuid4())  # type: ignore[arg-type]
