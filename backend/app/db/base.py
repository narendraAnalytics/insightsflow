"""Declarative base shared by every SQLAlchemy model. Import this Base in
each model module (app/db/models/...) so Alembic's autogenerate can see all
tables through Base.metadata.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
