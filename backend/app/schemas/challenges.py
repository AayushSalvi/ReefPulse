"""Pydantic models for challenges, trophies, and cohort comparison (demo-backed)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChallengeDefinition(BaseModel):
    id: str
    title: str
    emoji: str
    theme: str
    blurb: str
    duration_days: int
    badge_name: str
    points: int


class ChallengeWithProgress(ChallengeDefinition):
    progress_pct: int
    completed: bool


class TrophyTier(BaseModel):
    id: str
    name: str
    min_points: int
    emoji: str


class TrophyBanner(BaseModel):
    points: int
    tier: TrophyTier
    next_tier: TrophyTier | None = None
    next_tier_progress_pct: int
    pts_to_next_tier: int
    season_label: str
    cohort_size: int
    your_rank: int
    beat_percent: int
    challenges_completed: int
    challenges_in_progress: int
    median_points: int
    average_points: int


class LeaderboardRow(BaseModel):
    handle: str
    points: int
    badges: int
    is_you: bool = False


class ChallengeProgressUpdate(BaseModel):
    challenge_id: str
    progress_pct: int | None = Field(None, ge=0, le=100)
    mark_complete: bool = False


class ChallengeThemesResponse(BaseModel):
    themes: list[dict[str, str]]
