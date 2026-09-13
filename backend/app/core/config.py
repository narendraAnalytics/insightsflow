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

    sentry_dsn: str | None = None

    @field_validator("cors_origins")
    @classmethod
    def _strip_origins(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance — import and call this, don't instantiate
    Settings() directly, so the whole app shares one parsed config."""
    return Settings()
