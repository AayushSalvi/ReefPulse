"""Challenges, trophy summary, and demo leaderboard."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import CurrentUserUuid, DbSession
from app.schemas.challenges import (
    ChallengeProgressUpdate,
    ChallengeThemesResponse,
    ChallengeWithProgress,
    LeaderboardRow,
    TrophyBanner,
)
from app.services import challenges_service

router = APIRouter(prefix="/challenges", tags=["challenges"])


@router.get("/themes", response_model=ChallengeThemesResponse)
def get_themes() -> ChallengeThemesResponse:
    return challenges_service.list_themes()


@router.get("", response_model=list[ChallengeWithProgress])
def list_challenges(
    db: DbSession,
    user_uuid: CurrentUserUuid,
    theme: str | None = Query(None, description="environmental | discovery | fun | all"),
) -> list[ChallengeWithProgress]:
    return challenges_service.list_challenges(db, user_uuid, theme)


@router.get("/me/trophy", response_model=TrophyBanner)
def get_my_trophy(db: DbSession, user_uuid: CurrentUserUuid) -> TrophyBanner:
    return challenges_service.trophy_banner(db, user_uuid)


@router.get("/me/leaderboard", response_model=list[LeaderboardRow])
def get_my_leaderboard_slice(db: DbSession, user_uuid: CurrentUserUuid) -> list[LeaderboardRow]:
    return challenges_service.leaderboard_slice(db, user_uuid)


@router.post("/me/progress", response_model=ChallengeWithProgress)
def post_my_progress(
    db: DbSession,
    user_uuid: CurrentUserUuid,
    body: ChallengeProgressUpdate,
) -> ChallengeWithProgress:
    out = challenges_service.update_progress(db, user_uuid, body)
    if not out:
        raise HTTPException(status_code=404, detail="Unknown challenge_id")
    return out
