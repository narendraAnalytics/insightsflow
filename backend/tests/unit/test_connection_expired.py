from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from google.auth.exceptions import RefreshError

from app.core.crypto import encrypt_token
from app.services import connection_service


class FakeSession:
    def __init__(self) -> None:
        self.commits = 0

    async def commit(self) -> None:
        self.commits += 1


async def test_rejected_refresh_token_marks_the_connection_expired(
    monkeypatch: pytest.MonkeyPatch,
):
    """A refresh token Google refuses (e.g. the 7-day limit in Testing mode) must not 500
    the whole Integrations page: the connection is flagged and a clear 409 is raised."""
    refresh_enc, version = encrypt_token("old-refresh-token")
    connection = SimpleNamespace(
        provider="google_sheets",
        status="connected",
        expires_at=datetime.now(UTC) - timedelta(hours=1),
        refresh_token_enc=refresh_enc,
        key_version=version,
        scopes="a,b",
    )

    def boom(*_args: object) -> None:
        raise RefreshError("invalid_grant: Token has been expired or revoked.")

    monkeypatch.setattr(connection_service.google_sheets, "refresh_access_token", boom)
    session = FakeSession()

    with pytest.raises(connection_service.ConnectionExpired) as exc:
        await connection_service.get_valid_access_token(session, connection)  # type: ignore[arg-type]

    assert connection.status == "expired"
    assert session.commits == 1
    assert exc.value.status_code == 409
    assert "Reconnect" in exc.value.message
