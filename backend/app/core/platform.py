"""Windows-only asyncio fix.

psycopg3's async mode requires a SelectorEventLoop; Windows' default
ProactorEventLoop raises psycopg.InterfaceError on every async connection.
`asyncio.set_event_loop_policy()` fixes this for any code path that lets
asyncio derive the loop from the current policy (e.g. plain
`asyncio.run(coro)` calls, such as Alembic's in migrations/env.py, or
pytest-asyncio).

It does NOT fix uvicorn: uvicorn (>=0.36) always calls
`asyncio.run(..., loop_factory=asyncio.ProactorEventLoop)` on Windows,
and an explicit loop_factory always overrides the policy. Running the app
locally therefore goes through app/dev_server.py instead, which builds its
own Server and drives it with `loop_factory=asyncio.SelectorEventLoop`
directly — see that file for the full explanation.

This is a no-op on Linux/macOS (always true in production — Render,
Coolify, Docker all run Linux), so it's always safe to call.
"""

import asyncio
import sys


def apply_windows_asyncio_fix() -> None:
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
