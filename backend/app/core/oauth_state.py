"""Signed, short-lived OAuth `state` tokens.

The OAuth callback (app/api/v1/connections.py) is a top-level browser
redirect from Google — it can't carry an Authorization header. So the
authenticated user's identity has to travel in the `state` param instead:
`connect-url` (a Bearer-authed endpoint) signs the current user's
clerk_user_id into `state` with OAUTH_STATE_SECRET; `callback` verifies
the signature and expiry before trusting it. This is HMAC-SHA256, not a
JWT, to avoid pulling in a JWT library for a single internal round-trip.

`state` also carries the PKCE `code_verifier` (see
app/integrations/google/sheets.py) for the same reason: `connect-url` and
`callback` are two separate, stateless requests (possibly handled by
different processes), so the verifier generated when building the
authorization URL has nowhere else to live until the callback needs it to
exchange the code. It rides in the same signed, single-use, 10-minute
param as the user id rather than a separate server-side store — a
pragmatic tradeoff for a stateless backend, not a full session store.
"""

import base64
import hashlib
import hmac
import json
import time

from app.core.config import get_settings
from app.core.errors import AppError

_TTL_SECONDS = 10 * 60  # OAuth consent round-trip should complete in minutes, not hours


class OAuthStateError(AppError):
    status_code = 400
    code = "invalid_oauth_state"


class OAuthStateNotConfigured(AppError):
    status_code = 500
    code = "oauth_state_not_configured"


def _secret() -> bytes:
    settings = get_settings()
    if not settings.oauth_state_secret:
        raise OAuthStateNotConfigured("OAUTH_STATE_SECRET is not configured")
    return settings.oauth_state_secret.encode()


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(data: str) -> bytes:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded.encode())


def sign_state(clerk_user_id: str, code_verifier: str) -> str:
    payload = json.dumps(
        {"uid": clerk_user_id, "cv": code_verifier, "exp": int(time.time()) + _TTL_SECONDS}
    ).encode()
    payload_b64 = _b64url_encode(payload)
    signature = hmac.new(_secret(), payload_b64.encode(), hashlib.sha256).digest()
    return f"{payload_b64}.{_b64url_encode(signature)}"


def verify_state(state: str) -> tuple[str, str]:
    """Returns (clerk_user_id, code_verifier) embedded in `state`, or raises
    OAuthStateError."""
    try:
        payload_b64, signature_b64 = state.split(".", 1)
        expected_signature = hmac.new(_secret(), payload_b64.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected_signature, _b64url_decode(signature_b64)):
            raise OAuthStateError("State signature mismatch")
        payload = json.loads(_b64url_decode(payload_b64))
    except OAuthStateError:
        raise
    except Exception as exc:
        raise OAuthStateError("Malformed state") from exc

    if payload.get("exp", 0) < time.time():
        raise OAuthStateError("State expired — please try connecting again")
    uid = payload.get("uid")
    code_verifier = payload.get("cv")
    if not uid or not code_verifier:
        raise OAuthStateError("State missing required fields")
    return uid, code_verifier
