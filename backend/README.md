# InsightFlow — Backend

AI Business Intelligence Agent backend. FastAPI + LangGraph + LangChain +
Sarvam-105B, Neon Postgres, Redis/Celery. See `../roadmap.txt` for the full
architecture and phased build plan.

## Local development

Prerequisites: Python 3.12, [uv](https://docs.astral.sh/uv/), Docker
(for Redis), a Neon Postgres branch.

```bash
cp .env.example .env   # fill in DATABASE_URL / DATABASE_URL_DIRECT
uv sync
docker compose up -d redis
uv run alembic upgrade head

# Linux / macOS / WSL:
uv run uvicorn app.main:app --reload

# Windows: use this instead of the uvicorn CLI directly — see
# app/dev_server.py for why (psycopg3 async needs a SelectorEventLoop;
# uvicorn's CLI forces ProactorEventLoop on Windows regardless of
# asyncio.set_event_loop_policy). No --reload; restart manually after
# code changes, or develop inside WSL/Docker if you want --reload.
uv run python -m app.dev_server
```

Check it's alive:

```bash
curl http://localhost:8000/api/v1/healthz
curl http://localhost:8000/api/v1/readyz
```

Note: `/readyz`'s database check allows up to 8s — Neon's serverless
compute auto-suspends when idle, and waking it (a "cold start") was
observed to take ~5s locally. That's normal, not a bug; a consistently
suspended dev branch just means nothing has queried it in the last few
minutes. See `app/api/v1/health.py`.

## Project layout

```
app/
  core/     settings, logging, error handling, request middleware
  db/       SQLAlchemy engine/session, declarative base, models (Phase 1+)
  api/v1/   route modules, mounted under /api/v1
  agent/    LangGraph graph + nodes (Phase 4)
  integrations/  Google Sheets / Notion / Slack / Razorpay clients (Phase 2-3)
  workers/  Celery app + tasks (Phase 4)
migrations/ Alembic (async, targets DATABASE_URL_DIRECT — the unpooled
            Neon endpoint; DDL/advisory locks aren't safe behind PgBouncer)
tests/
```

## Commands

```bash
uv run ruff check .              # lint
uv run ruff format .             # format
uv run mypy app                  # type check
uv run pytest                    # tests
uv run alembic revision --autogenerate -m "message"
uv run alembic upgrade head
```

## Database branches (Neon project: insightsflow)

- `production` — the live app, never used for local dev.
- `dev` — local development target (see `.env`).
- Create a short-lived branch per feature/PR once Phase 1+ needs it
  (`mcp__neon__create_branch` or the Neon console), point `.env` at it,
  delete it when the PR merges.
