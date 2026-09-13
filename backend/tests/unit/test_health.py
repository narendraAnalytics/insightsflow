import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_healthz(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_readyz_reports_degraded_without_real_deps(client: AsyncClient) -> None:
    # In CI/local test runs there is no real Postgres/Redis at the test
    # DATABASE_URL, so /readyz should report "degraded" rather than crash.
    resp = await client.get("/api/v1/readyz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in {"ok", "degraded"}
    assert "database" in body["checks"]
    assert "redis" in body["checks"]
