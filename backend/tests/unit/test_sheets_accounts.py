import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest

from app.services import connection_service, credit_service, data_source_service

USER = SimpleNamespace(id=uuid.uuid4())


def _conn(provider: str, email: str | None, age_days: int, *, config: dict | None = None) -> Any:
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=USER.id,
        provider=provider,
        status="connected",
        external_account_email=email,
        created_at=datetime.now(UTC) - timedelta(days=age_days),
        config=config,
    )


class FakeSession:
    """Every row of every provider; `execute` can't see the WHERE, so it filters by the
    provider the code under test is asking for (set via `ask`)."""

    def __init__(self, rows: list[Any]) -> None:
        self.rows = rows
        self.commits = 0

    async def execute(self, stmt: object) -> Any:
        text = str(stmt.compile(compile_kwargs={"literal_binds": True}))  # type: ignore[attr-defined]
        wanted = [r for r in self.rows if f"'{r.provider}'" in text]
        ordered = sorted(wanted, key=lambda c: c.created_at)
        return SimpleNamespace(scalars=lambda: iter(ordered))

    def add(self, row: Any) -> None:
        row.id = uuid.uuid4()
        row.created_at = datetime.now(UTC)
        self.rows.append(row)

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, _row: Any) -> None:
        return None


class Spend:
    def __init__(self) -> None:
        self.calls = 0

    async def __call__(self, *_a: Any, **_k: Any) -> None:
        self.calls += 1


@pytest.fixture
def spend(monkeypatch: pytest.MonkeyPatch) -> Spend:
    async def fake_user(_session: object, _clerk_id: str) -> Any:
        return USER

    spender = Spend()
    monkeypatch.setattr(connection_service, "get_or_create_user", fake_user)
    monkeypatch.setattr(credit_service, "spend", spender)
    return spender


def _tokens(monkeypatch: pytest.MonkeyPatch, email: str | None) -> None:
    tokens = SimpleNamespace(
        access_token="a",
        refresh_token="r",
        expires_at=datetime.now(UTC) + timedelta(hours=1),
        scopes=["s"],
        email=email,
    )
    monkeypatch.setattr(connection_service.google_sheets, "exchange_code", lambda *_a: tokens)


async def _connect(session: FakeSession) -> Any:
    return await connection_service.complete_google_connect(session, "u", "code", "cv")  # type: ignore[arg-type]


async def test_first_login_is_default_and_free(monkeypatch: pytest.MonkeyPatch, spend: Spend):
    _tokens(monkeypatch, "a@x.com")
    session = FakeSession([])
    conn = await _connect(session)
    assert conn.config["default"] is True
    assert spend.calls == 0  # connecting a login costs nothing; tabs do


async def test_second_address_is_added_not_default(monkeypatch: pytest.MonkeyPatch, spend: Spend):
    _tokens(monkeypatch, "b@x.com")
    first = _conn("google_sheets", "a@x.com", 5, config={"default": True})
    session = FakeSession([first])
    conn = await _connect(session)
    assert conn is not first
    assert not (conn.config or {}).get("default")
    assert len([r for r in session.rows if r.provider == "google_sheets"]) == 2


async def test_same_address_refreshes_the_existing_login(
    monkeypatch: pytest.MonkeyPatch, spend: Spend
):
    _tokens(monkeypatch, "a@x.com")
    first = _conn("google_sheets", "a@x.com", 5, config={"default": True})
    session = FakeSession([first])
    assert await _connect(session) is first
    assert first.config["default"] is True


async def test_legacy_login_without_an_address_is_refreshed_not_duplicated(
    monkeypatch: pytest.MonkeyPatch, spend: Spend
):
    _tokens(monkeypatch, "a@x.com")
    legacy = _conn("google_sheets", None, 5)
    session = FakeSession([legacy])
    assert await _connect(session) is legacy
    assert legacy.external_account_email == "a@x.com"


async def test_sixth_login_is_refused(monkeypatch: pytest.MonkeyPatch, spend: Spend):
    _tokens(monkeypatch, "new@x.com")
    rows = [_conn("google_sheets", f"{i}@x.com", 10 - i) for i in range(5)]
    session = FakeSession(rows)
    with pytest.raises(connection_service.TooManyAccounts):
        await _connect(session)


async def test_login_is_linked_to_the_gmail_with_the_same_address(
    monkeypatch: pytest.MonkeyPatch, spend: Spend
):
    _tokens(monkeypatch, "a@x.com")
    gmail = _conn("gmail", "a@x.com", 5, config={"default": True})
    other = _conn("gmail", "z@x.com", 4)
    session = FakeSession([gmail, other])
    conn = await _connect(session)
    assert conn.config["gmail_connection_id"] == str(gmail.id)


async def test_connecting_the_gmail_later_links_the_existing_login(
    monkeypatch: pytest.MonkeyPatch, spend: Spend
):
    sheets = _conn("google_sheets", "a@x.com", 5, config={"default": True})
    gmail = _conn("gmail", "a@x.com", 1)
    session = FakeSession([sheets, gmail])
    await connection_service.autolink_sheets(session, USER.id)  # type: ignore[arg-type]
    assert sheets.config["gmail_connection_id"] == str(gmail.id)
    assert sheets.config["default"] is True


async def test_stale_sources_are_read_with_their_own_logins_token(
    monkeypatch: pytest.MonkeyPatch, spend: Spend
):
    old = datetime.now(UTC) - timedelta(hours=2)
    c1, c2 = uuid.uuid4(), uuid.uuid4()

    def src(cid: uuid.UUID, sheet: str) -> Any:
        return SimpleNamespace(
            id=uuid.uuid4(),
            connection_id=cid,
            external_id=sheet,
            tab_title="T",
            synced_at=old,
            created_at=old,
        )

    sources = [src(c1, "s1"), src(c2, "s2")]

    async def listed(*_a: Any) -> list[Any]:
        return sources

    async def conn_token(_s: object, _c: str, connection_id: uuid.UUID | None = None) -> Any:
        return None, f"token-{'1' if connection_id == c1 else '2'}"

    seen: dict[str, str] = {}

    def fetch(token: str, sheet: str, _tab: str | None) -> Any:
        seen[sheet] = token
        return SimpleNamespace(name="n", tab_title="T", tab_id=1, headers=["h"], row_count=1)

    monkeypatch.setattr(data_source_service, "list_sources", listed)
    monkeypatch.setattr(data_source_service, "_connection_and_token", conn_token)
    monkeypatch.setattr(data_source_service.google_sheets, "fetch_sheet_metadata", fetch)
    await data_source_service.refresh_stale_sources(FakeSession([]), "u")  # type: ignore[arg-type]
    assert seen == {"s1": "token-1", "s2": "token-2"}


def test_the_connections_list_reports_a_sheets_logins_gmail_link():
    from app.api.v1.connections import ConnectionResponse

    gmail_id = str(uuid.uuid4())
    sheets = _conn("google_sheets", "a@x.com", 1, config={"gmail_connection_id": gmail_id})
    sheets.scopes = "s"
    out = ConnectionResponse.from_model(sheets, [])
    assert out.gmail_connection_id == gmail_id
