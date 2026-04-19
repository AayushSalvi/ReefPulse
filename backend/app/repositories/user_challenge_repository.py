"""Per-user challenge progress in SQL."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import User, UserChallengeProgress
from app.repositories.challenges_repository import CHALLENGE_BY_ID, CHALLENGE_DEFINITIONS
from app.schemas.challenges import ChallengeWithProgress


class UserChallengeRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def ensure_user(self, user_id: str, *, handle: str | None = None) -> User:
        u = self._session.scalar(select(User).where(User.id == user_id))
        if u:
            return u
        u = User(id=user_id, external_key=None, handle=handle or "Snorkeler")
        self._session.add(u)
        self._session.flush()
        return u

    def _row(self, user_id: str, challenge_id: str) -> UserChallengeProgress | None:
        return self._session.scalar(
            select(UserChallengeProgress).where(
                UserChallengeProgress.user_id == user_id,
                UserChallengeProgress.challenge_id == challenge_id,
            )
        )

    def list_for_user(self, user_id: str, theme: str | None) -> list[ChallengeWithProgress]:
        rows = {
            r.challenge_id: r
            for r in self._session.scalars(select(UserChallengeProgress).where(UserChallengeProgress.user_id == user_id))
        }
        out: list[ChallengeWithProgress] = []
        for d in CHALLENGE_DEFINITIONS:
            if theme and theme != "all" and d.theme != theme:
                continue
            r = rows.get(d.id)
            completed = bool(r and r.completed)
            progress = 100 if completed else (r.progress_pct if r else 0)
            out.append(ChallengeWithProgress(**d.model_dump(), progress_pct=progress, completed=completed))
        return out

    def update_progress(
        self,
        user_id: str,
        challenge_id: str,
        progress_pct: int | None,
        mark_complete: bool,
    ) -> ChallengeWithProgress | None:
        d = CHALLENGE_BY_ID.get(challenge_id)
        if not d:
            return None
        self.ensure_user(user_id)
        row = self._row(user_id, challenge_id)
        if not row:
            row = UserChallengeProgress(user_id=user_id, challenge_id=challenge_id, progress_pct=0, completed=False)
            self._session.add(row)
        if mark_complete:
            row.completed = True
            row.progress_pct = 100
        elif progress_pct is not None:
            row.progress_pct = progress_pct
        self._session.flush()
        completed = row.completed
        prog = 100 if completed else row.progress_pct
        return ChallengeWithProgress(**d.model_dump(), progress_pct=prog, completed=completed)

    def trophy_points(self, user_id: str) -> int:
        total = 0
        for r in self._session.scalars(
            select(UserChallengeProgress).where(
                UserChallengeProgress.user_id == user_id,
                UserChallengeProgress.completed.is_(True),
            )
        ):
            if c := CHALLENGE_BY_ID.get(r.challenge_id):
                total += c.points
        return total

    def challenge_counts(self, user_id: str) -> tuple[int, int, int]:
        rows = list(self._session.scalars(select(UserChallengeProgress).where(UserChallengeProgress.user_id == user_id)))
        by_id = {r.challenge_id: r for r in rows}
        completed_n = sum(1 for r in rows if r.completed)
        in_prog = 0
        not_started = 0
        for d in CHALLENGE_DEFINITIONS:
            r = by_id.get(d.id)
            if r and r.completed:
                continue
            if r and r.progress_pct > 0:
                in_prog += 1
            else:
                not_started += 1
        return completed_n, in_prog, not_started
