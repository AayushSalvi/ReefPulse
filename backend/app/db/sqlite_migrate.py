"""Lightweight SQLite fixes for dev DBs created before newer columns existed."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine


def apply_sqlite_user_auth_columns(engine: Engine) -> None:
    """Add users.email / users.password_hash if missing (create_all does not ALTER tables)."""
    if engine.dialect.name != "sqlite":
        return
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        col_names = {r[1] for r in rows}
        added_email = False
        if "email" not in col_names:
            conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(255)"))
            added_email = True
        if "password_hash" not in col_names:
            conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))
        if added_email:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users(email)"))
