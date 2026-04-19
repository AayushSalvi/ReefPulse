"""SQLite FTS5 index for community post search (no-op on other dialects)."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine


def is_sqlite_engine(engine: Engine) -> bool:
    return engine.dialect.name == "sqlite"


def rebuild_posts_fts(engine: Engine) -> None:
    """(Re)create posts_fts + triggers from current `posts` rows. Safe to call after seed."""
    if not is_sqlite_engine(engine):
        return
    stmts = [
        "DROP TABLE IF EXISTS posts_fts",
        """
        CREATE VIRTUAL TABLE posts_fts USING fts5(
            post_id UNINDEXED,
            species,
            username,
            author,
            text,
            tokenize = 'porter unicode61'
        )
        """,
        """
        INSERT INTO posts_fts(post_id, species, username, author, text)
        SELECT id, species, COALESCE(username, ''), author, text FROM posts
        """,
        "DROP TRIGGER IF EXISTS posts_ai_fts",
        "DROP TRIGGER IF EXISTS posts_au_fts",
        "DROP TRIGGER IF EXISTS posts_ad_fts",
        """
        CREATE TRIGGER posts_ai_fts AFTER INSERT ON posts BEGIN
            INSERT INTO posts_fts(post_id, species, username, author, text)
            VALUES (new.id, new.species, COALESCE(new.username, ''), new.author, new.text);
        END
        """,
        """
        CREATE TRIGGER posts_au_fts AFTER UPDATE ON posts BEGIN
            DELETE FROM posts_fts WHERE post_id = old.id;
            INSERT INTO posts_fts(post_id, species, username, author, text)
            VALUES (new.id, new.species, COALESCE(new.username, ''), new.author, new.text);
        END
        """,
        """
        CREATE TRIGGER posts_ad_fts AFTER DELETE ON posts BEGIN
            DELETE FROM posts_fts WHERE post_id = old.id;
        END
        """,
    ]
    with engine.begin() as conn:
        for sql in stmts:
            conn.execute(text(sql))


def posts_fts_table_exists(engine: Engine) -> bool:
    if not is_sqlite_engine(engine):
        return False
    with engine.connect() as conn:
        r = conn.execute(
            text("SELECT 1 FROM sqlite_master WHERE type='table' AND name='posts_fts'")
        ).scalar()
        return r is not None
