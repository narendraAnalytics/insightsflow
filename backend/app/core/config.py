"""Application settings.

Single source of truth for environment configuration. Every setting used
anywhere in the app must be declared here — never read os.environ directly
in application code. Extended in later phases (Clerk, Razorpay, integrations,
Sarvam) as those pieces are implemented; see roadmap.txt section 8.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "staging", "production", "test"] = "development"
    log_level: str = "INFO"

    # CORS_ORIGINS is a comma-separated list in the env file, e.g.
    # "http://localhost:3000,https://app.insightflow.ai"
    cors_origins: str = "http://localhost:3000"

    public_api_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    database_url: str = Field(..., description="Pooled Neon connection string (app runtime)")
    database_url_direct: str = Field(
        ..., description="Unpooled Neon connection string (Alembic migrations only)"
    )

    redis_url: str = "redis://localhost:6379/0"

    # Clerk webhook (Svix-signed) -> upserts users into Neon.
    clerk_webhook_secret: str | None = None

    # Clerk JWT verification (get_current_principal, app/core/security.py).
    # clerk_secret_key is required. clerk_jwt_key (PEM public key, from Clerk
    # Dashboard -> API Keys -> Show JWT public key) enables networkless
    # verification (no per-request network call); if unset, the SDK falls
    # back to fetching Clerk's JWKS over the network per request — still
    # correct, just slower. CLERK_AUTHORIZED_PARTIES is a comma-separated
    # list of allowed frontend origins (same shape as CORS_ORIGINS).
    clerk_secret_key: str | None = None
    clerk_jwt_key: str | None = None
    clerk_authorized_parties: str = "http://localhost:3000"

    sentry_dsn: str | None = None

    # Phase 3: Google Sheets OAuth (drive.file scope — see roadmap.txt
    # "App #1"). google_redirect_uri must exactly match a URI registered on
    # the OAuth client in Google Cloud Console. oauth_state_secret signs the
    # OAuth `state` param (app/core/oauth_state.py) so the callback can
    # recover which user started the flow without needing a bearer token on
    # that request (it's a top-level browser redirect from Google, not a
    # fetch(), so no Authorization header is possible).
    # token_encryption_keys format: "v1:base64fernetkey" — comma-separated
    # for key rotation, e.g. "v1:oldkey,v2:newkey"; the last entry is used
    # for new encryptions, all entries are usable for decryption by version.
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str | None = None
    oauth_state_secret: str | None = None
    token_encryption_keys: str | None = None

    @field_validator("cors_origins")
    @classmethod
    def _strip_origins(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def clerk_authorized_parties_list(self) -> list[str]:
        return [o.strip() for o in self.clerk_authorized_parties.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance — import and call this, don't instantiate
    Settings() directly, so the whole app shares one parsed config."""
    return Settings()
