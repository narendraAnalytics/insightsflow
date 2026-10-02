import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest

from app.core.errors import NotFoundError
from app.services import connection_service

USER = SimpleNamespace(id=uuid.uuid4())


def _conn(email: str, age_days: int, *, default: bool = False) -> Any:
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=USER.id,
        provider="gmail",
        external_account_email=email,
        created_at=datetime.now(UTC) - timedelta(days=age_days),
        config={"default": True} if default else None,
    )


class FakeSession:
    """Returns the rows ordered by created_at (what the SQL ORDER BY gives)."""

    def __init__(self, rows: list[Any]) -> None:
        self.rows = rows
        self.deleted: list[Any] = []
        self.commits = 0

    async def execute(self, _stmt: object) -> Any:
        ordered = sorted(self.rows, key=lambda c: c.created_at)
        return SimpleNamespace(scalars=lambda: iter(ordered))

    async def delete(self, row: Any) -> None:
        self.deleted.append(row)
        self.rows = [r for r in self.rows if r is not row]

    async def commit(self) -> None:
        self.commits += 1


@pytest.fixture(autouse=True)
def _user(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_user(_session: object, _clerk_id: str) -> Any:
        return USER

    monkeypatch.setattr(connection_service, "get_or_create_user", fake_user)


async def test_default_account_comes_first_then_oldest():
    oldest, middle, flagged = (
        _conn("a@x.com", 9),
        _conn("b@x.com", 5),
        _conn("c@x.com", 1, default=True),
    )
    session = FakeSession([middle, flagged, oldest])
    rows = await connection_service.provider_connections(session, USER.id, "gmail")  # type: ignore[arg-type]
    assert rows == [flagged, oldest, middle]


async def test_no_flag_means_the_oldest_is_the_default():
    oldest, newer = _conn("a@x.com", 9), _conn("b@x.com", 1)
    session = FakeSession([newer, oldest])
    got = await connection_service.get_connection(session, "u", "gmail")  # type: ignore[arg-type]
    assert got is oldest


async def test_get_connection_by_id_and_unknown_id():
    a, b = _conn("a@x.com", 9, default=True), _conn("b@x.com", 1)
    session = FakeSession([a, b])
    assert await connection_service.get_connection(session, "u", "gmail", b.id) is b  # type: ignore[arg-type]
    with pytest.raises(NotFoundError):
        await connection_service.get_connection(session, "u", "gmail", uuid.uuid4())  # type: ignore[arg-type]


async def test_disconnecting_the_default_promotes_the_oldest_remaining():
    a, b, c = _conn("a@x.com", 9), _conn("b@x.com", 5, default=True), _conn("c@x.com", 1)
    session = FakeSession([a, b, c])
    await connection_service.disconnect(session, "u", "gmail", b.id)  # type: ignore[arg-type]
    assert session.deleted == [b]
    assert connection_service.is_default(a) and not connection_service.is_default(c)
    assert session.commits == 1


async def test_disconnecting_a_non_default_keeps_the_default():
    a, b = _conn("a@x.com", 9, default=True), _conn("b@x.com", 1)
    session = FakeSession([a, b])
    await connection_service.disconnect(session, "u", "gmail", b.id)  # type: ignore[arg-type]
    assert connection_service.is_default(a)


async def test_set_default_moves_the_flag_and_rejects_unknown_ids():
    a, b = _conn("a@x.com", 9, default=True), _conn("b@x.com", 1)
    session = FakeSession([a, b])
    await connection_service.set_default(session, "u", b.id)  # type: ignore[arg-type]
    assert connection_service.is_default(b) and not connection_service.is_default(a)
    with pytest.raises(NotFoundError):
        await connection_service.set_default(session, "u", uuid.uuid4())  # type: ignore[arg-type]
