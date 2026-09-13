# InsightFlow

**AI Business Intelligence Agent** — a production-grade, multi-step AI
agent that connects to and takes action across real business apps.

A user asks, in plain language (English, Hindi, or Telugu — text or
voice): *"Why did sales drop in Hyderabad last week? Tell the team."*
InsightFlow then:

1. **Reads** the data from **Google Sheets**
2. Syncs it and runs **deterministic analysis** (DuckDB/Pandas — the LLM
   never does the math itself) with **Sarvam-105B** reasoning over the
   verified numbers via **LangGraph** + **LangChain**
3. Drafts a report and **waits for human approval** before doing anything
4. Writes the report to **Notion**
5. Posts an alert to **Slack**

Every step is persisted and resumable — a crash mid-run picks back up
from its last checkpoint, not from scratch.

## Why this project

Most "chat with your data" demos stop at answering a question. InsightFlow
is built as a real product: authenticated multi-tenant SaaS (Clerk),
billed subscriptions (Razorpay), a durable agent (LangGraph checkpoints
on Postgres), and actions across three external systems gated behind
explicit human approval — not a notebook, a running service.

## Tech stack

| Layer | Choice |
|---|---|
| Agent orchestration | LangGraph + LangChain |
| LLM | Sarvam-105B (`langchain-sarvam`) |
| Backend API | FastAPI (async), SQLAlchemy 2 |
| Database | Neon Postgres (+ pgvector later) |
| Queue / cache | Redis + Celery |
| Auth | Clerk |
| Billing | Razorpay Subscriptions |
| Frontend | Next.js + TypeScript, installable PWA |
| Deploy | Render (stage 1) → Coolify on a VPS (stage 2) |

## Repository layout

```
backend/     FastAPI + LangGraph backend — see backend/README.md
frontend/    Next.js + React PWA — added in Phase 1 (not yet created)
```

## Status

This project is being built in phases — see the roadmap for the full
architecture, phase checklists, and what's done vs. planned. Phase 0
(backend foundations: app structure, Neon wiring, health checks, CI,
Docker) is complete; Phase 1 (Clerk auth + multi-tenancy) is next.

## Getting started (backend)

```bash
cd backend
cp .env.example .env   # fill in your Neon connection strings
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload   # Linux/macOS/WSL
uv run python -m app.dev_server        # Windows
```

Full instructions: [`backend/README.md`](backend/README.md).

## License

Not yet decided / all rights reserved for now.
