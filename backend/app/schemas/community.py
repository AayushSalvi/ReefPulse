"""Pydantic models for community feed (sightings-style posts)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ChallengeCompletion(BaseModel):
    """Optional highlight when a post is tied to a challenge."""

    challenge_id: str
    title: str
    badge_name: str
    emoji: str = ""


class CommunityPost(BaseModel):
    id: str
    species: str
    username: str | None = None
    author: str
    location_id: str
    location_name: str
    text: str
    visibility: str | None = None
    tips: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    likes: int = 0
    comments_count: int = 0
    image_url: str | None = None
    created_at: datetime
    challenge_completion: ChallengeCompletion | None = None
    liked_by_you: bool = False
    saved_by_you: bool = False


class CommunityPostCreate(BaseModel):
    """Create payload. Display name comes from the authenticated user, not from this body."""

    species: str
    location_id: str
    location_name: str
    text: str
    visibility: str | None = None
    tips: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    image_url: str | None = None
    image_s3_key: str | None = Field(
        default=None,
        description="S3 object key returned from POST /community/media/presign; validated against your user prefix.",
    )
    challenge_id: str | None = None


class CommunityPostLikeResponse(BaseModel):
    post_id: str
    likes: int
    liked_by_you: bool


class CommunityComment(BaseModel):
    id: str
    post_id: str
    parent_comment_id: str | None = None
    author: str
    text: str
    created_at: datetime
    moderation_status: str = "ok"


class CommunityCommentCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    parent_comment_id: str | None = None


class CommunityFeedResponse(BaseModel):
    posts: list[CommunityPost]
    total: int
    limit: int = 20
    offset: int = 0
    next_cursor: str | None = None
    has_more: bool = False


class CommunityCommentsPageResponse(BaseModel):
    comments: list[CommunityComment]
    total: int
    limit: int = 50
    offset: int = 0
    has_more: bool = False


class MediaPresignRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=200)
    content_type: str = Field(..., min_length=3, max_length=128)
    size_bytes: int = Field(..., ge=1, le=52428800)


class MediaPresignResponse(BaseModel):
    upload_url: str
    object_key: str
    public_url: str
    expires_in: int
    headers: dict[str, str] = Field(default_factory=dict)
