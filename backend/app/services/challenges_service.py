"""Challenges + trophy banner derived from DB-backed progress and static catalog."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.repositories import challenges_repository
from app.repositories.user_challenge_repository import UserChallengeRepository
from app.schemas.challenges import (
    ChallengeProgressUpdate,
    ChallengeThemesResponse,
    ChallengeWithProgress,
    LeaderboardRow,
    TrophyBanner,
    TrophyTier,
)


THEMES = [
    {"id": "all", "label": "All"},
    {"id": "environmental", "label": "Environmental"},
    {"id": "discovery", "label": "Discover species"},
    {"id": "fun", "label": "Fun & social"},
]


def list_challenges(session: Session, user_id: str, theme: str | None) -> list[ChallengeWithProgress]:
    ucr = UserChallengeRepository(session)
    ucr.ensure_user(user_id)
    return ucr.list_for_user(user_id, theme or "all")


def list_themes() -> ChallengeThemesResponse:
    return ChallengeThemesResponse(themes=THEMES)


def _next_tier_progress(points: int, tier: TrophyTier, nxt: TrophyTier | None) -> tuple[int, int]:
    if not nxt:
        return 100, 0
    span = nxt.min_points - tier.min_points
    if span <= 0:
        return 100, 0
    pct = min(100, round(((points - tier.min_points) / span) * 100))
    gap = max(0, nxt.min_points - points)
    return pct, gap


def trophy_banner(session: Session, user_id: str) -> TrophyBanner:
    ucr = UserChallengeRepository(session)
    ucr.ensure_user(user_id)
    points = ucr.trophy_points(user_id)
    tier = challenges_repository.current_tier(points)
    nxt = challenges_repository.next_tier(points)
    pct, gap = _next_tier_progress(points, tier, nxt)
    comp = challenges_repository.cohort_comparison(points)
    done, in_prog, _ = ucr.challenge_counts(user_id)
    return TrophyBanner(
        points=points,
        tier=tier,
        next_tier=nxt,
        next_tier_progress_pct=pct,
        pts_to_next_tier=gap,
        season_label="Spring 2026",
        cohort_size=comp["cohort_size"],
        your_rank=comp["your_rank"],
        beat_percent=comp["beat_percent"],
        challenges_completed=done,
        challenges_in_progress=in_prog,
        median_points=comp["median_points"],
        average_points=comp["average_points"],
    )


def leaderboard_slice(session: Session, user_id: str) -> list[LeaderboardRow]:
    ucr = UserChallengeRepository(session)
    u = ucr.ensure_user(user_id)
    points = ucr.trophy_points(user_id)
    done, _, _ = ucr.challenge_counts(user_id)
    return challenges_repository.leaderboard_slice(user_id, u.handle, points, done)


def update_progress(session: Session, user_id: str, body: ChallengeProgressUpdate) -> ChallengeWithProgress | None:
    ucr = UserChallengeRepository(session)
    ucr.ensure_user(user_id)
    return ucr.update_progress(
        user_id,
        body.challenge_id,
        body.progress_pct,
        body.mark_complete,
    )
