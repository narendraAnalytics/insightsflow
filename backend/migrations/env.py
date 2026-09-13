import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import get_settings
from app.core.platform import apply_windows_asyncio_fix
from app.db.base import Base

apply_windows_asyncio_fix()  # must run before asyncio.run() below (Windows dev)

# Import every model module here so Base.metadata is fully populated before
# autogenerate runs. Empty for now (Phase 0) — Phase 1 adds
# app.db.models.org, app.db.models.user, etc.
# from app.db.models import org, user  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Alembic always uses the DIRECT (unpooled) Neon endpoint: DDL and the
# advisory lock Alembic takes are not safe/reliable behind a transaction-mode
# pooler like Neon's default PgBouncer endpoint.
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url_direct)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
