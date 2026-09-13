"""Local Windows dev entrypoint.

Why this file exists: on Windows, uvicorn (>=0.36) always launches its
server with `asyncio.run(..., loop_factory=asyncio.ProactorEventLoop)` —
see uvicorn/loops/asyncio.py. This bypasses `asyncio.set_event_loop_policy`
entirely (an explicit loop_factory always wins over the policy), so a
Proactor loop is created no matter what policy is set beforehand.
psycopg3's async driver cannot run under ProactorEventLoop
("Psycopg cannot use the 'ProactorEventLoop' to run in async mode").

The fix is to not go through `uvicorn.run()` / `Server.run()` at all:
build the Server ourselves and drive it with our own
`asyncio.run(..., loop_factory=asyncio.SelectorEventLoop)` call.

Production (Render/Coolify/Docker) always runs on Linux, where none of
this applies — use the plain `uvicorn app.main:app` CLI there (see
Dockerfile / docker-compose.yml).

Note: --reload is intentionally not used here. Uvicorn's reload supervisor
runs the server in a subprocess that does its own Server.run(), which would
hit the same ProactorEventLoop issue again. Restart this script manually
after code changes, or develop inside Docker/WSL (Linux) if you want
--reload locally.
"""

import asyncio

import uvicorn


def main() -> None:
    config = uvicorn.Config("app.main:app", host="0.0.0.0", port=8000)
    server = uvicorn.Server(config)
    asyncio.run(server.serve(), loop_factory=asyncio.SelectorEventLoop)


if __name__ == "__main__":
    main()
