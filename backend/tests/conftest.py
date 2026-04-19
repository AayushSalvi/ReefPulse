"""Pytest: set DATABASE_URL, create schema + seed (TestClient without `with` skips app lifespan)."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_fd, _TEST_DB_PATH = tempfile.mkstemp(suffix=".sqlite", prefix="reefpulse_test_")
os.close(_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH}"

from app.db.base import Base  # noqa: E402
from app.db.seed import seed_if_empty  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.db.sqlite_migrate import apply_sqlite_user_auth_columns  # noqa: E402
from app.db.sqlite_fts import rebuild_posts_fts  # noqa: E402

Base.metadata.create_all(bind=engine)
apply_sqlite_user_auth_columns(engine)
with SessionLocal() as session:
    seed_if_empty(session)
    session.commit()
rebuild_posts_fts(engine)


def pytest_sessionfinish(session, exitstatus):  # noqa: ARG001
    # * Close pooled connections so Windows can delete the temp SQLite file.
    engine.dispose()
    Path(_TEST_DB_PATH).unlink(missing_ok=True)
