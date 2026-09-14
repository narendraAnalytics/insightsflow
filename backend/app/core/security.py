"""Clerk-verified request authentication: `get_current_principal` is the
FastAPI dependency every protected route depends on to know who's calling.

Verification goes through Clerk's official `clerk-backend-api` SDK rather
than hand-rolled PyJWT + manual JWKS handling — the SDK is networkless
(zero per-request network calls) when CLERK_JWT_KEY is configured, and
correctly checks signature, exp/nbf, issuer, and authorized parties
(`azp`) in one call. See backend/CLAUDE.md for why this is the
production-grade path vs. verifying tokens by hand.
"""

from dataclasses import dataclass
from functools import lru_cache

from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from fastapi import Request

from app.core.config import get_settings
from app.core.errors import AppError


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"


@dataclass(frozen=True)
class Principal:
    user_id: str
    session_id: str | None
    org_id: str | None
    org_role: str | None


@lru_cache
def _get_clerk_client() -> Clerk:
    settings = get_settings()
    return Clerk(bearer_auth=settings.clerk_secret_key)


async def get_current_principal(request: Request) -> Principal:
    settings = get_settings()
    if not settings.clerk_secret_key:
        raise UnauthorizedError("CLERK_SECRET_KEY is not configured")

    options = AuthenticateRequestOptions(
        jwt_key=settings.clerk_jwt_key,
        authorized_parties=settings.clerk_authorized_parties_list,
    )
    state = _get_clerk_client().authenticate_request(request, options)

    if not state.is_signed_in or state.payload is None:
        raise UnauthorizedError(state.message or "Not authenticated")

    payload = state.payload
    return Principal(
        user_id=payload["sub"],
        session_id=payload.get("sid"),
        org_id=payload.get("org_id"),
        org_role=payload.get("org_role"),
    )
