import os
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient

# Set safe test-mode env vars before app.core.config is imported anywhere,
# so tests never accidentally touch a real Neon branch.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")
os.environ.setdefault("DATABASE_URL_DIRECT", "postgresql+psycopg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("OAUTH_STATE_SECRET", "test-oauth-state-secret")
os.environ.setdefault(
    "TOKEN_ENCRYPTION_KEYS", "v1:mKUhWVMqVOzfdV9BQHmHOSDI2ja0M071vHODFpR6igE="
)

from app.main import create_app  # noqa: E402


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
