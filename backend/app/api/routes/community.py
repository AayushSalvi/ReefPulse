"""Community feed: posts, likes, comments, saves, media presign."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import CurrentUserUuid, DbSession
from app.schemas.community import (
    CommunityComment,
    CommunityCommentCreate,
    CommunityCommentsPageResponse,
    CommunityFeedResponse,
    CommunityPost,
    CommunityPostCreate,
    CommunityPostLikeResponse,
    MediaPresignRequest,
    MediaPresignResponse,
)
from app.services import community_service
from app.services import community_media_service

router = APIRouter(prefix="/community", tags=["community"])


@router.get("/posts", response_model=CommunityFeedResponse)
def get_posts(
    db: DbSession,
    viewer: CurrentUserUuid,
    tag: str | None = Query(None, description="Tag filter, e.g. fish, reef, or 'all'."),
    location_id: str | None = Query(None, description="Beach / location id."),
    species_query: str | None = Query(None, description="Search species, caption, or @username."),
    sort: str = Query("recent", description="recent | popular | nearby"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    cursor: str | None = Query(None, description="Opaque cursor from prior response (recent | popular only)."),
    use_fts: bool = Query(True, description="Use SQLite FTS5 for species_query when available."),
) -> CommunityFeedResponse:
    posts, total, next_cursor, has_more, lim, off = community_service.list_posts(
        db,
        viewer,
        tag=tag,
        location_id=location_id,
        species_query=species_query,
        sort=sort,
        limit=limit,
        offset=offset,
        cursor=cursor,
        use_fts=use_fts,
    )
    return CommunityFeedResponse(
        posts=posts,
        total=total,
        limit=lim,
        offset=off,
        next_cursor=next_cursor,
        has_more=has_more,
    )


@router.get("/posts/{post_id}", response_model=CommunityPost)
def get_post(db: DbSession, viewer: CurrentUserUuid, post_id: str) -> CommunityPost:
    post = community_service.get_post(db, post_id, viewer)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.post("/posts", response_model=CommunityPost, status_code=201)
def create_post(db: DbSession, viewer: CurrentUserUuid, body: CommunityPostCreate) -> CommunityPost:
    return community_service.create_post(db, viewer, body)


@router.post("/media/presign", response_model=MediaPresignResponse)
def presign_media_upload(viewer: CurrentUserUuid, body: MediaPresignRequest) -> MediaPresignResponse:
    return community_media_service.presign_community_upload(viewer, body)


@router.post("/posts/{post_id}/like", response_model=CommunityPostLikeResponse)
def like_post(db: DbSession, viewer: CurrentUserUuid, post_id: str) -> CommunityPostLikeResponse:
    out = community_service.like_post(db, viewer, post_id)
    if out is None:
        raise HTTPException(status_code=404, detail="Post not found")
    likes, liked = out
    return CommunityPostLikeResponse(post_id=post_id, likes=likes, liked_by_you=liked)


@router.delete("/posts/{post_id}/like", response_model=CommunityPostLikeResponse)
def unlike_post(db: DbSession, viewer: CurrentUserUuid, post_id: str) -> CommunityPostLikeResponse:
    out = community_service.unlike_post(db, viewer, post_id)
    if out is None:
        raise HTTPException(status_code=404, detail="Post not found")
    likes, liked = out
    return CommunityPostLikeResponse(post_id=post_id, likes=likes, liked_by_you=liked)


@router.post("/posts/{post_id}/save", status_code=204)
def save_post(db: DbSession, viewer: CurrentUserUuid, post_id: str) -> None:
    ok = community_service.set_post_saved(db, viewer, post_id, True)
    if ok is None:
        raise HTTPException(status_code=404, detail="Post not found")


@router.delete("/posts/{post_id}/save", status_code=204)
def unsave_post(db: DbSession, viewer: CurrentUserUuid, post_id: str) -> None:
    ok = community_service.set_post_saved(db, viewer, post_id, False)
    if ok is None:
        raise HTTPException(status_code=404, detail="Post not found")


@router.get("/posts/{post_id}/comments", response_model=CommunityCommentsPageResponse)
def get_comments(
    db: DbSession,
    viewer: CurrentUserUuid,
    post_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    include_removed: bool = Query(False, description="Include soft-deleted comments (text redacted)."),
) -> CommunityCommentsPageResponse:
    if not community_service.get_post(db, post_id, viewer):
        raise HTTPException(status_code=404, detail="Post not found")
    rows, total = community_service.list_comments(
        db, post_id, limit=limit, offset=offset, include_removed=include_removed
    )
    has_more = offset + len(rows) < total
    return CommunityCommentsPageResponse(
        comments=rows,
        total=total,
        limit=limit,
        offset=offset,
        has_more=has_more,
    )


@router.post("/posts/{post_id}/comments", response_model=CommunityComment, status_code=201)
def create_comment(
    db: DbSession,
    viewer: CurrentUserUuid,
    post_id: str,
    body: CommunityCommentCreate,
) -> CommunityComment:
    if not community_service.get_post(db, post_id, viewer):
        raise HTTPException(status_code=404, detail="Post not found")
    c = community_service.add_comment(db, viewer, post_id, body)
    if not c:
        raise HTTPException(status_code=400, detail="Invalid parent_comment_id or post not found")
    return c


@router.delete("/posts/{post_id}/comments/{comment_id}", status_code=204)
def delete_comment(db: DbSession, viewer: CurrentUserUuid, post_id: str, comment_id: str) -> None:
    ok = community_service.soft_delete_comment(db, viewer, post_id, comment_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Comment not found or not allowed")

