"""Community feed filters, pagination, and mapping to API models."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Post, User
from app.repositories.challenges_repository import challenge_highlight
from app.repositories.community_repository import (
    CommunityRepository,
    decode_popular_cursor,
    decode_recent_cursor,
)
from app.repositories.user_challenge_repository import UserChallengeRepository
from app.schemas.community import (
    ChallengeCompletion,
    CommunityComment,
    CommunityCommentCreate,
    CommunityPost,
    CommunityPostCreate,
)


def _display_from_user(user: User) -> tuple[str, str | None]:
    handle = (user.handle or "Snorkeler").strip() or "Snorkeler"
    slug = handle.lower().replace(" ", "_")[:128]
    return handle, slug


def _post_row_from_orm(
    post: Post,
    *,
    liked: bool = False,
    saved: bool = False,
) -> dict[str, Any]:
    cc = challenge_highlight(post.challenge_id) if post.challenge_id else None
    author = post.author
    username = post.username
    if post.author_user_id and post.author_user:
        author, username = _display_from_user(post.author_user)
    return {
        "id": post.id,
        "species": post.species,
        "username": username,
        "author": author,
        "location_id": post.location_id,
        "location_name": post.location_name,
        "text": post.text,
        "visibility": post.visibility,
        "tips": post.tips or [],
        "tags": post.tags or [],
        "likes": post.likes,
        "comments_count": post.comments_count,
        "image_url": post.image_url,
        "created_at": post.created_at,
        "challenge_completion": cc,
        "liked_by_you": liked,
        "saved_by_you": saved,
    }


def _to_post(row: dict[str, Any]) -> CommunityPost:
    cc = row.get("challenge_completion")
    completion = ChallengeCompletion(**cc) if cc else None
    return CommunityPost(
        id=row["id"],
        species=row["species"],
        username=row.get("username"),
        author=row["author"],
        location_id=row["location_id"],
        location_name=row["location_name"],
        text=row["text"],
        visibility=row.get("visibility"),
        tips=list(row.get("tips") or []),
        tags=list(row.get("tags") or []),
        likes=int(row.get("likes", 0)),
        comments_count=int(row.get("comments_count", 0)),
        image_url=row.get("image_url"),
        created_at=row["created_at"],
        challenge_completion=completion,
        liked_by_you=bool(row.get("liked_by_you")),
        saved_by_you=bool(row.get("saved_by_you")),
    )


def _resolve_image_url(user_id: str, body: CommunityPostCreate) -> str | None:
    if body.image_s3_key:
        prefix = f"{settings.community_s3_key_prefix.strip().strip('/')}/{user_id}/"
        key = body.image_s3_key.strip()
        if not key.startswith(prefix):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="image_s3_key must use the prefix returned from the presign endpoint for your account",
            )
        return f"https://{settings.s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{key}"
    return body.image_url


def list_posts(
    session: Session,
    viewer_user_id: str,
    *,
    tag: str | None = None,
    location_id: str | None = None,
    species_query: str | None = None,
    sort: str = "recent",
    limit: int = 20,
    offset: int = 0,
    cursor: str | None = None,
    use_fts: bool = True,
) -> tuple[list[CommunityPost], int, str | None, bool, int, int]:
    """Returns (posts, total, next_cursor, has_more, limit, offset)."""
    lim = max(1, min(limit, 100))
    off = max(0, offset)
    repo = CommunityRepository(session)
    recent_c = None
    popular_c = None
    if cursor and sort == "recent":
        try:
            recent_c = decode_recent_cursor(cursor)
        except (KeyError, ValueError, OSError, UnicodeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cursor") from None
    elif cursor and sort == "popular":
        try:
            popular_c = decode_popular_cursor(cursor)
        except (KeyError, ValueError, OSError, UnicodeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cursor") from None
    elif cursor and sort == "nearby":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cursor pagination is not supported for sort=nearby; use offset",
        )

    page, total, next_r, next_p, has_more = repo.list_posts_page(
        tag=tag,
        location_id=location_id,
        species_query=species_query,
        use_fts=use_fts,
        sort=sort,
        limit=lim,
        offset=off,
        recent_cursor=recent_c,
        popular_cursor=popular_c,
    )
    ids = [p.id for p in page]
    liked_set, saved_set = repo.viewer_post_flags(viewer_user_id, ids)
    out = [
        _to_post(
            _post_row_from_orm(
                p,
                liked=p.id in liked_set,
                saved=p.id in saved_set,
            )
        )
        for p in page
    ]
    next_cursor = next_r if sort == "recent" else (next_p if sort == "popular" else None)
    return out, total, next_cursor, has_more, lim, off


def get_post(session: Session, post_id: str, viewer_user_id: str) -> CommunityPost | None:
    repo = CommunityRepository(session)
    p = repo.get_post(post_id)
    if not p:
        return None
    liked = repo.user_liked_post(viewer_user_id, post_id)
    saved = repo.user_saved_post(viewer_user_id, post_id)
    return _to_post(_post_row_from_orm(p, liked=liked, saved=saved))


def create_post(session: Session, user_id: str, body: CommunityPostCreate) -> CommunityPost:
    ucr = UserChallengeRepository(session)
    user = ucr.ensure_user(user_id)
    author, username = _display_from_user(user)
    image_url = _resolve_image_url(user_id, body)
    repo = CommunityRepository(session)
    challenge_id = None
    if body.challenge_id and challenge_highlight(body.challenge_id):
        challenge_id = body.challenge_id
    p = Post(
        id=str(uuid.uuid4()),
        author_user_id=user_id,
        species=body.species,
        username=username,
        author=author,
        location_id=body.location_id,
        location_name=body.location_name,
        text=body.text,
        visibility=body.visibility,
        tips=body.tips,
        tags=body.tags,
        likes=0,
        comments_count=0,
        image_url=image_url,
        challenge_id=challenge_id,
        created_at=datetime.now(timezone.utc),
    )
    repo.insert_post(p)
    session.refresh(p)
    liked = repo.user_liked_post(user_id, p.id)
    saved = repo.user_saved_post(user_id, p.id)
    return _to_post(_post_row_from_orm(p, liked=liked, saved=saved))


def like_post(session: Session, user_id: str, post_id: str) -> tuple[int, bool] | None:
    ucr = UserChallengeRepository(session)
    ucr.ensure_user(user_id)
    out = CommunityRepository(session).add_like(user_id, post_id)
    if not out:
        return None
    return out


def unlike_post(session: Session, user_id: str, post_id: str) -> tuple[int, bool] | None:
    ucr = UserChallengeRepository(session)
    ucr.ensure_user(user_id)
    out = CommunityRepository(session).remove_like(user_id, post_id)
    if not out:
        return None
    return out


def set_post_saved(session: Session, user_id: str, post_id: str, saved: bool) -> bool | None:
    ucr = UserChallengeRepository(session)
    ucr.ensure_user(user_id)
    return CommunityRepository(session).set_saved(user_id, post_id, saved)


def list_comments(
    session: Session,
    post_id: str,
    *,
    limit: int = 50,
    offset: int = 0,
    include_removed: bool = False,
) -> tuple[list[CommunityComment], int]:
    lim = max(1, min(limit, 200))
    off = max(0, offset)
    rows, total = CommunityRepository(session).list_comments(
        post_id, limit=lim, offset=off, include_removed=include_removed
    )
    return (
        [
            CommunityComment(
                id=c.id,
                post_id=c.post_id,
                parent_comment_id=c.parent_id,
                author=c.author,
                text=c.text,
                created_at=c.created_at,
                moderation_status=c.moderation_status or "ok",
            )
            for c in rows
        ],
        total,
    )


def add_comment(
    session: Session,
    user_id: str,
    post_id: str,
    body: CommunityCommentCreate,
) -> CommunityComment | None:
    ucr = UserChallengeRepository(session)
    user = ucr.ensure_user(user_id)
    author, _ = _display_from_user(user)
    c = CommunityRepository(session).add_comment(
        post_id,
        author_user_id=user_id,
        author_display=author,
        text=body.text,
        parent_id=body.parent_comment_id,
    )
    if not c:
        return None
    return CommunityComment(
        id=c.id,
        post_id=c.post_id,
        parent_comment_id=c.parent_id,
        author=c.author,
        text=c.text,
        created_at=c.created_at,
        moderation_status=c.moderation_status or "ok",
    )


def soft_delete_comment(session: Session, user_id: str, post_id: str, comment_id: str) -> bool:
    UserChallengeRepository(session).ensure_user(user_id)
    return CommunityRepository(session).soft_delete_comment(post_id, comment_id, user_id)
