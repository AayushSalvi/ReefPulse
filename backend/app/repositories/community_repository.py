"""Community posts, likes, saves, and comments (SQLAlchemy + SQLite FTS when available)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, case, func, or_, select, text
from sqlalchemy.orm import Session, joinedload

from app.db.models import Comment, Post, PostLike, SavedPost
from app.db.sqlite_fts import posts_fts_table_exists


class CommunityRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _is_sqlite(self) -> bool:
        return self._session.get_bind().dialect.name == "sqlite"

    def _tag_clause(self, tag: str) -> Any:
        if self._is_sqlite():
            return text(
                "EXISTS (SELECT 1 FROM json_each(COALESCE(posts.tags, '[]')) AS j WHERE j.value = :tagv)"
            ).bindparams(tagv=tag)
        return Post.tags.contains([tag])

    def _species_text_clause(self, pattern: str) -> Any:
        """Case-insensitive substring match when FTS is unavailable."""
        p = f"%{pattern}%"
        return or_(
            Post.species.ilike(p),
            Post.text.ilike(p),
            func.coalesce(Post.username, "").ilike(p),
            Post.author.ilike(p),
        )

    def _fts_clause(self, fts_query: str) -> Any:
        return text("posts.id IN (SELECT post_id FROM posts_fts WHERE posts_fts MATCH :mq)").bindparams(mq=fts_query)

    def _build_where(
        self,
        *,
        tag: str | None,
        location_id: str | None,
        species_query: str | None,
        use_fts: bool,
        recent_cursor: tuple[datetime, str] | None,
        popular_cursor: tuple[int, str] | None,
    ) -> list[Any]:  # noqa: PLR0913
        clauses: list[Any] = []
        if tag and tag != "all":
            clauses.append(self._tag_clause(tag))
        if location_id:
            clauses.append(Post.location_id == location_id)
        sq = (species_query or "").strip()
        if sq:
            if use_fts and self._is_sqlite() and posts_fts_table_exists(self._session.get_bind()):
                clauses.append(self._fts_clause(_sanitize_fts_match(sq)))
            else:
                clauses.append(self._species_text_clause(sq))
        if recent_cursor:
            ct, pid = recent_cursor
            clauses.append(or_(Post.created_at < ct, and_(Post.created_at == ct, Post.id < pid)))
        if popular_cursor:
            lk, pid = popular_cursor
            clauses.append(or_(Post.likes < lk, and_(Post.likes == lk, Post.id < pid)))
        return clauses

    def _order_by(self, sort: str) -> Any:
        if sort == "popular":
            return (Post.likes.desc(), Post.id.desc())
        if sort == "nearby":
            nearby_rank = case(
                (Post.location_id == "la-jolla-shores", 0),
                (Post.location_id == "carmel-river-beach", 1),
                (Post.location_id == "crystal-cove", 2),
                (Post.location_id == "leo-carrillo", 3),
                (Post.location_id == "refugio-beach", 4),
                else_=99,
            )
            return (nearby_rank, Post.created_at.desc(), Post.id.desc())
        return (Post.created_at.desc(), Post.id.desc())

    def list_posts_page(
        self,
        *,
        tag: str | None,
        location_id: str | None,
        species_query: str | None,
        use_fts: bool,
        sort: str,
        limit: int,
        offset: int,
        recent_cursor: tuple[datetime, str] | None,
        popular_cursor: tuple[int, str] | None,
    ) -> tuple[list[Post], int, str | None, str | None, bool]:
        """Returns (posts, total_count, next_cursor_recent, next_cursor_popular, has_more)."""
        clauses = self._build_where(
            tag=tag,
            location_id=location_id,
            species_query=species_query,
            use_fts=use_fts,
            recent_cursor=recent_cursor if sort == "recent" else None,
            popular_cursor=popular_cursor if sort == "popular" else None,
        )
        where_block = and_(*clauses) if clauses else None

        count_stmt = select(func.count()).select_from(Post)
        if where_block is not None:
            count_stmt = count_stmt.where(where_block)
        total = int(self._session.scalar(count_stmt) or 0)

        order_cols = self._order_by(sort)
        base = select(Post).options(joinedload(Post.author_user))
        if where_block is not None:
            base = base.where(where_block)
        base = base.order_by(*order_cols)
        if offset > 0:
            if sort == "nearby":
                base = base.offset(offset)
            elif sort == "recent" and not recent_cursor:
                base = base.offset(offset)
            elif sort == "popular" and not popular_cursor:
                base = base.offset(offset)

        fetch_limit = min(limit + 1, 501)
        rows = list(self._session.scalars(base.limit(fetch_limit)))
        has_more = len(rows) > limit
        page = rows[:limit]

        next_recent: str | None = None
        next_pop: str | None = None
        if has_more and page:
            last = page[-1]
            if sort == "recent":
                next_recent = _encode_recent_cursor(last.created_at, last.id)
            elif sort == "popular":
                next_pop = _encode_popular_cursor(int(last.likes or 0), last.id)
        return page, total, next_recent, next_pop, has_more

    def viewer_post_flags(self, user_id: str, post_ids: list[str]) -> tuple[set[str], set[str]]:
        if not post_ids:
            return set(), set()
        liked = set(
            self._session.scalars(
                select(PostLike.post_id).where(PostLike.user_id == user_id, PostLike.post_id.in_(post_ids))
            )
        )
        saved = set(
            self._session.scalars(
                select(SavedPost.post_id).where(SavedPost.user_id == user_id, SavedPost.post_id.in_(post_ids))
            )
        )
        return liked, saved

    def get_post(self, post_id: str) -> Post | None:
        return self._session.scalar(
            select(Post).options(joinedload(Post.author_user)).where(Post.id == post_id)
        )

    def insert_post(self, post: Post) -> Post:
        self._session.add(post)
        self._session.flush()
        return post

    def user_liked_post(self, user_id: str, post_id: str) -> bool:
        return self._session.scalar(
            select(PostLike.id).where(PostLike.user_id == user_id, PostLike.post_id == post_id)
        ) is not None

    def user_saved_post(self, user_id: str, post_id: str) -> bool:
        return self._session.scalar(
            select(SavedPost.id).where(SavedPost.user_id == user_id, SavedPost.post_id == post_id)
        ) is not None

    def add_like(self, user_id: str, post_id: str) -> tuple[int, bool] | None:
        """Returns (likes_count, liked) or None if post missing."""
        p = self.get_post(post_id)
        if not p:
            return None
        existing = self._session.scalar(
            select(PostLike).where(PostLike.user_id == user_id, PostLike.post_id == post_id)
        )
        if existing:
            return int(p.likes or 0), True
        self._session.add(
            PostLike(post_id=post_id, user_id=user_id, created_at=datetime.now(timezone.utc))
        )
        p.likes = int(p.likes or 0) + 1
        self._session.flush()
        return int(p.likes), True

    def remove_like(self, user_id: str, post_id: str) -> tuple[int, bool] | None:
        p = self.get_post(post_id)
        if not p:
            return None
        row = self._session.scalar(select(PostLike).where(PostLike.user_id == user_id, PostLike.post_id == post_id))
        if not row:
            return int(p.likes or 0), False
        self._session.delete(row)
        p.likes = max(0, int(p.likes or 0) - 1)
        self._session.flush()
        return int(p.likes), False

    def set_saved(self, user_id: str, post_id: str, saved: bool) -> bool | None:
        """Returns None if post missing, True if state applied (idempotent)."""
        p = self.get_post(post_id)
        if not p:
            return None
        row = self._session.scalar(select(SavedPost).where(SavedPost.user_id == user_id, SavedPost.post_id == post_id))
        if saved:
            if not row:
                self._session.add(
                    SavedPost(user_id=user_id, post_id=post_id, created_at=datetime.now(timezone.utc))
                )
                self._session.flush()
            return True
        if row:
            self._session.delete(row)
            self._session.flush()
        return True

    def add_comment(
        self,
        post_id: str,
        *,
        author_user_id: str,
        author_display: str,
        text: str,
        parent_id: str | None,
    ) -> Comment | None:
        p = self.get_post(post_id)
        if not p:
            return None
        if parent_id:
            parent = self._session.scalar(
                select(Comment).where(Comment.id == parent_id, Comment.post_id == post_id)
            )
            if not parent:
                return None
        c = Comment(
            id=str(uuid.uuid4()),
            post_id=post_id,
            parent_id=parent_id,
            author_user_id=author_user_id,
            author=author_display,
            text=text,
            created_at=datetime.now(timezone.utc),
            moderation_status="ok",
        )
        self._session.add(c)
        p.comments_count = int(p.comments_count or 0) + 1
        self._session.flush()
        return c

    def list_comments(
        self,
        post_id: str,
        *,
        limit: int,
        offset: int,
        include_removed: bool,
    ) -> tuple[list[Comment], int]:
        filt: list[Any] = [Comment.post_id == post_id]
        if not include_removed:
            filt.append(Comment.deleted_at.is_(None))
        where_c = and_(*filt)
        total = int(self._session.scalar(select(func.count()).select_from(Comment).where(where_c)) or 0)
        rows = list(
            self._session.scalars(
                select(Comment).where(where_c).order_by(Comment.created_at.asc()).offset(offset).limit(limit)
            )
        )
        return rows, total

    def soft_delete_comment(self, post_id: str, comment_id: str, user_id: str) -> bool:
        c = self._session.scalar(
            select(Comment).where(
                Comment.id == comment_id,
                Comment.post_id == post_id,
                Comment.author_user_id == user_id,
                Comment.deleted_at.is_(None),
            )
        )
        if not c:
            return False
        c.deleted_at = datetime.now(timezone.utc)
        c.text = "[removed]"
        p = self.get_post(post_id)
        if p:
            p.comments_count = max(0, int(p.comments_count or 0) - 1)
        self._session.flush()
        return True


def _sanitize_fts_match(q: str) -> str:
    parts = [t for t in "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in q).lower().split() if t]
    if not parts:
        return "x_unmatchable_token_zz"
    return " OR ".join(f"{p}*" for p in parts[:12])


def _encode_recent_cursor(created_at: datetime, post_id: str) -> str:
    import base64
    import json

    payload = {"t": created_at.isoformat(), "i": post_id}
    raw = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    return raw


def _encode_popular_cursor(likes: int, post_id: str) -> str:
    import base64
    import json

    payload = {"l": likes, "i": post_id}
    return base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")


def decode_recent_cursor(token: str) -> tuple[datetime, str]:
    import base64
    import json

    pad = "=" * (-len(token) % 4)
    raw = base64.urlsafe_b64decode(token + pad)
    d = json.loads(raw.decode())
    return datetime.fromisoformat(d["t"]), str(d["i"])


def decode_popular_cursor(token: str) -> tuple[int, str]:
    import base64
    import json

    pad = "=" * (-len(token) % 4)
    raw = base64.urlsafe_b64decode(token + pad)
    d = json.loads(raw.decode())
    return int(d["l"]), str(d["i"])
