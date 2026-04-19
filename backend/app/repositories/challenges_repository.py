"""Static challenge catalog + trophy math (no per-user state — that lives in the DB)."""

from __future__ import annotations

from typing import Any

from app.schemas.challenges import ChallengeDefinition, LeaderboardRow, TrophyTier


def _definitions() -> list[dict[str, Any]]:
    return [
        {
            "id": "eco-shore-clean",
            "title": "Shoreline guardian",
            "emoji": "🌊",
            "theme": "environmental",
            "blurb": "Log 3 beach visits with a photo and one piece of debris removed or reported.",
            "duration_days": 14,
            "badge_name": "Tide line steward",
            "points": 50,
        },
        {
            "id": "species-bingo",
            "title": "New fins bingo",
            "emoji": "🐠",
            "theme": "discovery",
            "blurb": "Spot 5 species you have not logged in ReefPulse before this month.",
            "duration_days": 30,
            "badge_name": "Curious snorkeler",
            "points": 80,
        },
        {
            "id": "kelp-quiet",
            "title": "Kelp forest quiet hour",
            "emoji": "🤫",
            "theme": "fun",
            "blurb": "One snorkel session where you observe without chasing wildlife — post field notes.",
            "duration_days": 7,
            "badge_name": "Low-impact observer",
            "points": 35,
        },
        {
            "id": "viz-logging",
            "title": "Visibility for science",
            "emoji": "📏",
            "theme": "environmental",
            "blurb": "Submit 4 visibility readings at different tides to help the community dataset.",
            "duration_days": 21,
            "badge_name": "Water column scout",
            "points": 60,
        },
        {
            "id": "tidepool-doc",
            "title": "Tidepool documentarian",
            "emoji": "📷",
            "theme": "discovery",
            "blurb": "Document 3 intertidal species with geotagged photos and respectful distance.",
            "duration_days": 10,
            "badge_name": "Rock pool archivist",
            "points": 45,
        },
        {
            "id": "buddy-snorkel",
            "title": "Buddy system weekend",
            "emoji": "🤿",
            "theme": "fun",
            "blurb": "Complete one snorkel with a partner and both post a safety checklist tick.",
            "duration_days": 5,
            "badge_name": "Pair diver",
            "points": 30,
        },
    ]


CHALLENGE_DEFINITIONS: list[ChallengeDefinition] = [ChallengeDefinition(**d) for d in _definitions()]
CHALLENGE_BY_ID: dict[str, ChallengeDefinition] = {c.id: c for c in CHALLENGE_DEFINITIONS}

TROPHY_TIERS: list[TrophyTier] = [
    TrophyTier(id="bronze", name="Bronze reef", min_points=0, emoji="🥉"),
    TrophyTier(id="silver", name="Silver current", min_points=100, emoji="🥈"),
    TrophyTier(id="gold", name="Gold kelp", min_points=250, emoji="🥇"),
    TrophyTier(id="platinum", name="Platinum tide", min_points=500, emoji="✨"),
]


def challenge_highlight(challenge_id: str) -> dict[str, str] | None:
    d = CHALLENGE_BY_ID.get(challenge_id)
    if not d:
        return None
    return {
        "challenge_id": d.id,
        "title": d.title,
        "badge_name": d.badge_name,
        "emoji": d.emoji,
    }


def current_tier(points: int) -> TrophyTier:
    tier = TROPHY_TIERS[0]
    for t in TROPHY_TIERS:
        if points >= t.min_points:
            tier = t
    return tier


def next_tier(points: int) -> TrophyTier | None:
    for t in TROPHY_TIERS:
        if points < t.min_points:
            return t
    return None


def cohort_comparison(points: int) -> dict[str, int]:
    cohort_size = 1184
    beat_percent = min(94, round(18 + points * 0.62))
    your_rank = max(1, min(cohort_size, round(cohort_size * (1 - beat_percent / 100) + 36)))
    return {
        "cohort_size": cohort_size,
        "your_rank": your_rank,
        "beat_percent": beat_percent,
        "median_points": 88,
        "average_points": 136,
    }


def leaderboard_slice(user_uuid: str, user_handle: str, points: int, badges: int) -> list[LeaderboardRow]:
    display = "You" if user_handle == "You" else user_handle[:20]
    peers = [
        LeaderboardRow(handle="kelp_kay", points=520, badges=11, is_you=False),
        LeaderboardRow(handle="monterey_moss", points=440, badges=9, is_you=False),
        LeaderboardRow(handle="tide_doc", points=380, badges=8, is_you=False),
        LeaderboardRow(handle="shoreline_sam", points=220, badges=5, is_you=False),
        LeaderboardRow(handle="float_fan", points=195, badges=4, is_you=False),
        LeaderboardRow(handle=display, points=points, badges=badges, is_you=True),
        LeaderboardRow(handle="reef_novice", points=72, badges=2, is_you=False),
        LeaderboardRow(handle="first_fin", points=40, badges=1, is_you=False),
    ]
    peers.sort(key=lambda r: r.points, reverse=True)
    return peers
