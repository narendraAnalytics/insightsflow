import uuid
from types import SimpleNamespace
from typing import Any

import pytest

from app.core.errors import NotFoundError
from app.services import connection_service, insights_service

READ = "https://www.googleapis.com/auth/gmail.readonly"
SEND = "https://www.googleapis.com/auth/gmail.send"


def _account(email: str, scopes: str) -> Any:
    return SimpleNamespace(id=uuid.uuid4(), status="connected", scopes=scopes, email=email)


@pytest.fixture
def accounts(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    both = _account("both@x.com", f"{READ},{SEND}")
    send_only = _account("send@x.com", SEND)
    by_id = {both.id: both, send_only.id: send_only}
    seen: dict[str, Any] = {}

    async def fake_get(_s: object, _c: str, _p: str, connection_id: uuid.UUID | None = None) -> Any:
        seen["asked"] = connection_id
        if connection_id is None:
            return both  # the default account
        if connection_id not in by_id:
            raise NotFoundError("no such account")
        return by_id[connection_id]

    async def fake_token(_s: object, c: Any) -> str:
        return f"token-for-{c.email}"

    monkeypatch.setattr(connection_service, "get_connection", fake_get)
    monkeypatch.setattr(connection_service, "get_valid_access_token", fake_token)
    return {"both": both, "send_only": send_only, "seen": seen}


async def test_no_choice_reads_the_default_account(accounts: dict[str, Any]):
    token, can_send = await insights_service._gmail_access(None, "u")  # type: ignore[arg-type]
    assert token == "token-for-both@x.com" and can_send
    assert accounts["seen"]["asked"] is None


async def test_the_chosen_account_is_the_one_read(accounts: dict[str, Any]):
    both = accounts["both"]
    token, _ = await insights_service._gmail_access(None, "u", both.id)  # type: ignore[arg-type]
    assert token == "token-for-both@x.com"
    assert accounts["seen"]["asked"] == both.id


async def test_an_account_without_read_permission_gives_no_mail_tool(accounts: dict[str, Any]):
    token, can_send = await insights_service._gmail_access(
        None,
        "u",
        accounts["send_only"].id,  # type: ignore[arg-type]
    )
    assert token is None and not can_send


async def test_an_unknown_account_gives_no_mail_tool_instead_of_failing(accounts: dict[str, Any]):
    token, can_send = await insights_service._gmail_access(None, "u", uuid.uuid4())  # type: ignore[arg-type]
    assert token is None and not can_send
