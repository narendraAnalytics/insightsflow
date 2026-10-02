import uuid
from types import SimpleNamespace
from typing import Any

import pytest

from app.core.crypto import encrypt_token
from app.integrations import slack
from app.services import connection_service, slack_service


def _connection(config: dict[str, Any]) -> Any:
    token_enc, version = encrypt_token("xoxb-fake")
    return SimpleNamespace(
        id=uuid.uuid4(),
        status="connected",
        access_token_enc=token_enc,
        key_version=version,
        config=config,
    )


async def test_test_message_posts_fixed_text_to_the_chosen_channel(monkeypatch: pytest.MonkeyPatch):
    posted: list[tuple[str, str, str]] = []

    async def fake_get(_s: object, _c: str, _p: str, _id: object = None) -> Any:
        return _connection({"channel_id": "C123", "channel_name": "general"})

    monkeypatch.setattr(connection_service, "get_connection", fake_get)
    monkeypatch.setattr(
        slack, "post_message", lambda t, c, text: posted.append((t, c, text)) or "1"
    )

    out = await slack_service.send_test(None, "u", uuid.uuid4())  # type: ignore[arg-type]

    assert out == {"channel_name": "general"}
    assert posted == [("xoxb-fake", "C123", slack_service.TEST_MESSAGE)]


async def test_test_message_needs_a_channel(monkeypatch: pytest.MonkeyPatch):
    async def fake_get(_s: object, _c: str, _p: str, _id: object = None) -> Any:
        return _connection({"team_id": "T1"})

    monkeypatch.setattr(connection_service, "get_connection", fake_get)
    with pytest.raises(slack_service.SlackChannelRequired):
        await slack_service.send_test(None, "u", uuid.uuid4())  # type: ignore[arg-type]


def test_not_in_channel_message_tells_the_user_how_to_fix_it():
    assert "/invite @InsightFlow" in slack._POST_ERRORS["not_in_channel"]
