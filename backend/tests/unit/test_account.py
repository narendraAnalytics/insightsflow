import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import pytest

from app.api.v1.account import ConfirmationRequired, ConfirmRequest, require_confirm
from app.core.crypto import encrypt_token
from app.services import account_service

USER = SimpleNamespace(
    id=uuid.uuid4(),
    email="a@b.co",
    name="A",
    username=None,
    created_at=datetime.now(UTC),
)


def test_confirm_must_be_the_word_delete():
    require_confirm(ConfirmRequest(confirm="DELETE"))
    require_confirm(ConfirmRequest(confirm="  DELETE "))
    for bad in ("", "delete", "yes", "DELETE ME"):
        with pytest.raises(ConfirmationRequired):
            require_confirm(ConfirmRequest(confirm=bad))


def _conn(provider: str, token: str = "tok", refresh: str | None = None) -> Any:
    access_enc, version = encrypt_token(token)
    refresh_enc = encrypt_token(refresh)[0] if refresh else None
    return SimpleNamespace(
        provider=provider,
        access_token_enc=access_enc,
        refresh_token_enc=refresh_enc,
        key_version=version,
    )


def test_grants_prefer_the_refresh_token_and_skip_undecryptable_rows():
    broken = SimpleNamespace(
        provider="gmail", access_token_enc="not-fernet", refresh_token_enc=None, key_version="v1"
    )
    grants = account_service.collect_grants(
        [_conn("gmail", "access", refresh="refresh"), _conn("slack", "bot"), broken]
    )
    assert [(g.provider, g.token) for g in grants] == [("gmail", "refresh"), ("slack", "bot")]


async def test_revoke_goes_to_the_right_provider_and_survives_failures(
    monkeypatch: pytest.MonkeyPatch,
):
    calls: list[tuple[str, str]] = []

    def google_revoke(token: str) -> None:
        calls.append(("google", token))
        raise RuntimeError("google is down")

    monkeypatch.setattr(account_service.google, "revoke_token", google_revoke)
    monkeypatch.setattr(account_service.slack, "revoke", lambda t: calls.append(("slack", t)))

    await account_service.revoke_all(
        [
            account_service.Grant("google_sheets", "g1"),
            account_service.Grant("slack", "s1"),
            account_service.Grant("notion", "n1"),  # nothing to call: must not raise
        ]
    )
    # A Google failure didn't stop Slack, and Notion made no call at all.
    assert calls == [("google", "g1"), ("slack", "s1")]


class FakeSession:
    def __init__(self) -> None:
        self.executed: list[object] = []
        self.commits = 0

    async def execute(self, stmt: object) -> Any:
        self.executed.append(stmt)
        return SimpleNamespace(scalars=lambda: iter([]))

    async def commit(self) -> None:
        self.commits += 1


class _Users:
    def __init__(self, error: Exception | None) -> None:
        self.error = error
        self.deleted: list[str] = []

    async def delete_async(self, user_id: str) -> None:
        if self.error:
            raise self.error
        self.deleted.append(user_id)


def _patch(monkeypatch: pytest.MonkeyPatch, error: Exception | None) -> _Users:
    users = _Users(error)

    async def fake_user(*_a: object, **_k: object) -> Any:
        return USER

    monkeypatch.setattr(account_service, "get_or_create_user", fake_user)
    monkeypatch.setattr(account_service, "clerk_client", lambda: SimpleNamespace(users=users))
    return users


async def test_account_is_untouched_when_clerk_refuses(monkeypatch: pytest.MonkeyPatch):
    users = _patch(monkeypatch, RuntimeError("clerk 500"))
    session = FakeSession()
    with pytest.raises(account_service.AccountDeletionFailed):
        await account_service.delete_account(session, "user_1")  # type: ignore[arg-type]
    assert session.commits == 0  # nothing local was deleted
    assert users.deleted == []


async def test_account_deletion_removes_the_clerk_user_then_the_rows(
    monkeypatch: pytest.MonkeyPatch,
):
    users = _patch(monkeypatch, None)
    session = FakeSession()
    await account_service.delete_account(session, "user_1")  # type: ignore[arg-type]
    assert users.deleted == ["user_1"]
    assert session.commits == 1


async def test_an_already_deleted_clerk_user_still_clears_local_data(
    monkeypatch: pytest.MonkeyPatch,
):
    gone = type("Gone", (Exception,), {"status_code": 404})()
    _patch(monkeypatch, gone)
    session = FakeSession()
    await account_service.delete_account(session, "user_1")  # type: ignore[arg-type]
    assert session.commits == 1


async def test_export_never_contains_tokens(monkeypatch: pytest.MonkeyPatch):
    async def fake_user(*_a: object, **_k: object) -> Any:
        return USER

    monkeypatch.setattr(account_service, "get_or_create_user", fake_user)
    conn = SimpleNamespace(
        user_id=USER.id,
        provider="slack",
        external_account_email="Acme",
        status="connected",
        scopes="chat:write",
        config={"channel_name": "general"},
        created_at=datetime.now(UTC),
        access_token_enc="SECRET-ACCESS",
        refresh_token_enc="SECRET-REFRESH",
    )

    class Session:
        async def execute(self, stmt: Any) -> Any:
            wanted = str(stmt).split("FROM ")[1].split()[0]
            rows = [conn] if wanted == "connections" else []
            return SimpleNamespace(scalars=lambda: iter(rows))

    data = await account_service.export_data(Session(), "user_1")  # type: ignore[arg-type]
    assert data["connections"][0]["account"] == "Acme"
    assert "SECRET" not in repr(data)
    assert data["profile"]["email"] == "a@b.co"
