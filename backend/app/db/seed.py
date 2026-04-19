"""Idempotent seed data for local / empty databases."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import DEMO_USER_EMAIL, DEMO_USER_PASSWORD, DEMO_USER_UUID
from app.db.models import Post, User, UserChallengeProgress
from app.services.auth_service import hash_password


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def seed_if_empty(session: Session) -> None:
    if session.scalar(select(User).where(User.id == DEMO_USER_UUID)):
        return

    demo = User(
        id=DEMO_USER_UUID,
        external_key="demo",
        email=DEMO_USER_EMAIL,
        password_hash=hash_password(DEMO_USER_PASSWORD),
        handle="You",
    )
    session.add(demo)

    progress_rows = [
        UserChallengeProgress(user_id=DEMO_USER_UUID, challenge_id="kelp-quiet", progress_pct=100, completed=True),
        UserChallengeProgress(user_id=DEMO_USER_UUID, challenge_id="tidepool-doc", progress_pct=100, completed=True),
        UserChallengeProgress(user_id=DEMO_USER_UUID, challenge_id="eco-shore-clean", progress_pct=66, completed=False),
        UserChallengeProgress(user_id=DEMO_USER_UUID, challenge_id="species-bingo", progress_pct=40, completed=False),
        UserChallengeProgress(user_id=DEMO_USER_UUID, challenge_id="viz-logging", progress_pct=25, completed=False),
        UserChallengeProgress(user_id=DEMO_USER_UUID, challenge_id="buddy-snorkel", progress_pct=0, completed=False),
    ]
    session.add_all(progress_rows)

    now = _utcnow()
    posts = [
        Post(
            id="s1",
            author_user_id=DEMO_USER_UUID,
            species="Garibaldi",
            username="maya_kelp",
            author="Maya K.",
            location_id="la-jolla-shores",
            location_name="La Jolla Shores",
            text="Clear water on the north reef — mild surge but easy entry. Pair of garibaldi on the outer kelp.",
            visibility="Good",
            tips=["Park early on weekends", "North reef less crowded before 10"],
            tags=["fish", "reef", "snorkel"],
            likes=248,
            comments_count=18,
            image_url="https://picsum.photos/seed/reefpulse-s1/1200/800",
            challenge_id="species-bingo",
            created_at=now,
        ),
        Post(
            id="s2",
            author_user_id=None,
            species="Leopard shark",
            username="jordan_floats",
            author="Jordan",
            location_id="la-jolla-shores",
            location_name="La Jolla Shores",
            text="Sandy channel had three leopards cruising slowly — great viz about 8–10 ft.",
            visibility="Excellent",
            tips=[],
            tags=["fish", "snorkel"],
            likes=412,
            comments_count=31,
            image_url="https://picsum.photos/seed/reefpulse-s2/1200/800",
            challenge_id=None,
            created_at=now - timedelta(seconds=1),
        ),
        Post(
            id="s3",
            author_user_id=None,
            species="Harbor seal",
            username="alex_tidepool",
            author="Alex R.",
            location_id="carmel-river-beach",
            location_name="Carmel River State Beach",
            text="Seals hauled out on the south rocks — gave them a wide berth. Kelp thin but pretty.",
            visibility="Medium",
            tips=["Stay 50+ yards from seals"],
            tags=["mammals", "reef", "snorkel"],
            likes=189,
            comments_count=0,
            image_url="https://picsum.photos/seed/reefpulse-s3/1200/800",
            challenge_id=None,
            created_at=now - timedelta(seconds=2),
        ),
        Post(
            id="s7",
            author_user_id=None,
            species="Giant kelp forest",
            username="nico_bluewater",
            author="Nico V.",
            location_id="carmel-river-beach",
            location_name="Monterey Bay",
            text="Cathedral light in the kelp — viz 15 ft, surge light. Worth the cold water.",
            visibility="Excellent",
            tips=["7mm wetsuit this week"],
            tags=["snorkel", "reef"],
            likes=521,
            comments_count=0,
            image_url="https://picsum.photos/seed/reefpulse-s7/1200/800",
            challenge_id="kelp-quiet",
            created_at=now - timedelta(seconds=3),
        ),
        Post(
            id="s8",
            author_user_id=None,
            species="Green sea turtle",
            username="reef_pulse_demo",
            author="ReefPulse",
            location_id="crystal-cove",
            location_name="Crystal Cove State Beach",
            text="Rare calm morning — turtle cruised the outer kelp line. Please keep distance if you spot one.",
            visibility="Good",
            tips=["NOAA guidelines apply"],
            tags=["snorkel", "reef"],
            likes=892,
            comments_count=0,
            image_url="https://picsum.photos/seed/reefpulse-s8/1200/800",
            challenge_id="tidepool-doc",
            created_at=now - timedelta(seconds=4),
        ),
    ]
    session.add_all(posts)
    session.flush()
