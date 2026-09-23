import time

import pytest

from app.core.oauth_state import OAuthStateError, sign_state, verify_state


def test_sign_and_verify_roundtrip() -> None:
    state = sign_state("user_abc123", "test-code-verifier")
    assert verify_state(state) == ("user_abc123", "test-code-verifier")


def test_tampered_state_is_rejected() -> None:
    state = sign_state("user_abc123", "test-code-verifier")
    payload_b64, signature_b64 = state.split(".", 1)
    tampered = f"{payload_b64}x.{signature_b64}"
    with pytest.raises(OAuthStateError):
        verify_state(tampered)


def test_expired_state_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    state = sign_state("user_abc123", "test-code-verifier")
    # Jump the clock forward past the 10-minute TTL.
    real_time = time.time
    monkeypatch.setattr(time, "time", lambda: real_time() + 3600)
    with pytest.raises(OAuthStateError):
        verify_state(state)
