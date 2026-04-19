"""ORM models for community posts and challenge progress."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    external_key: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    handle: Mapped[str] = mapped_column(String(128), default="Snorkeler")

    posts: Mapped[list["Post"]] = relationship(back_populates="author_user")
    challenge_progress: Mapped[list["UserChallengeProgress"]] = relationship(back_populates="user")
    post_likes: Mapped[list["PostLike"]] = relationship(back_populates="user")
    saved_posts: Mapped[list["SavedPost"]] = relationship(back_populates="user")
    comments: Mapped[list["Comment"]] = relationship(back_populates="author_user")


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (
        Index("ix_posts_created_at_id", "created_at", "id"),
        Index("ix_posts_location_id", "location_id"),
        Index("ix_posts_likes_id", "likes", "id"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    author_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    species: Mapped[str] = mapped_column(String(255))
    username: Mapped[str | None] = mapped_column(String(128), nullable=True)
    author: Mapped[str] = mapped_column(String(255))
    location_id: Mapped[str] = mapped_column(String(128))
    location_name: Mapped[str] = mapped_column(String(255))
    text: Mapped[str] = mapped_column(Text())
    visibility: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tips: Mapped[list | None] = mapped_column(JSON, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    challenge_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    author_user: Mapped["User | None"] = relationship(back_populates="posts")
    comments: Mapped[list["Comment"]] = relationship(back_populates="post")
    likes_rows: Mapped[list["PostLike"]] = relationship(back_populates="post", cascade="all, delete-orphan")
    saved_by: Mapped[list["SavedPost"]] = relationship(back_populates="post", cascade="all, delete-orphan")


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_like_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[str] = mapped_column(String(40), ForeignKey("posts.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    post: Mapped["Post"] = relationship(back_populates="likes_rows")
    user: Mapped["User"] = relationship(back_populates="post_likes")


class SavedPost(Base):
    __tablename__ = "saved_posts"
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_saved_post_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    post_id: Mapped[str] = mapped_column(String(40), ForeignKey("posts.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="saved_posts")
    post: Mapped["Post"] = relationship(back_populates="saved_by")


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (Index("ix_comments_post_created", "post_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    post_id: Mapped[str] = mapped_column(String(40), ForeignKey("posts.id", ondelete="CASCADE"))
    parent_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("comments.id", ondelete="SET NULL"), nullable=True)
    author_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    author: Mapped[str] = mapped_column(String(255))
    text: Mapped[str] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    moderation_status: Mapped[str] = mapped_column(String(32), default="ok")

    post: Mapped["Post"] = relationship(back_populates="comments")
    author_user: Mapped["User"] = relationship(back_populates="comments")


class UserChallengeProgress(Base):
    __tablename__ = "user_challenge_progress"
    __table_args__ = (UniqueConstraint("user_id", "challenge_id", name="uq_user_challenge"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    challenge_id: Mapped[str] = mapped_column(String(64))
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="challenge_progress")
