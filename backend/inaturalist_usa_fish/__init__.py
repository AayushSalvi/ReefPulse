"""iNaturalist USA fish location tool — public API."""

from __future__ import annotations

import httpx

from inaturalist_usa_fish.client import fetch_observations_near
from inaturalist_usa_fish.config import (
    DEFAULT_CA_PLACE_ID,
    DEFAULT_FISH_TAXON_IDS,
    DEFAULT_PLACE_ID,
    DEFAULT_US_PLACE_ID,
)
from inaturalist_usa_fish.models import FishObservation
from inaturalist_usa_fish.normalize import observations_to_fish_records


def fetch_fish_near(
    latitude: float,
    longitude: float,
    *,
    radius_km: float = 25.0,
    place_id: int = DEFAULT_PLACE_ID,
    taxon_ids: tuple[int, ...] = DEFAULT_FISH_TAXON_IDS,
    quality_grade: str | None = "research",
    per_page: int = 50,
    max_pages: int | None = 10,
    page_sleep_seconds: float = 0.0,
    client: httpx.Client | None = None,
) -> list[FishObservation]:
    """Return identified fish observations near a coordinate, scoped to a place (default: California).

    Args:
        latitude: Query center latitude (decimal degrees).
        longitude: Query center longitude (decimal degrees).
        radius_km: Search radius used to build the API bounding box.
        place_id: iNaturalist place id limiting results (default: California). Use
            ``DEFAULT_US_PLACE_ID`` (1) for the entire United States.
        taxon_ids: Fish root taxon ids included in the search.
        quality_grade: Pass the string ``research`` for research-grade only, or ``None`` for all grades.
        per_page: API page size (max 200).
        max_pages: Safety cap on pagination depth.
        page_sleep_seconds: Optional delay between HTTP pages.
        client: Optional shared :class:`httpx.Client`.

    Returns:
        Normalized :class:`FishObservation` instances with coordinates, taxon id, image URLs, and
        ``posted_at`` (iNaturalist ``created_at`` submission time when present).
    """
    raw = fetch_observations_near(
        latitude,
        longitude,
        radius_km=radius_km,
        place_id=place_id,
        taxon_ids=taxon_ids,
        photos=True,
        geo=True,
        quality_grade=quality_grade,
        per_page=per_page,
        max_pages=max_pages,
        page_sleep_seconds=page_sleep_seconds,
        client=client,
    )
    return observations_to_fish_records(raw)


from inaturalist_usa_fish.lambda_handler import lambda_handler

__all__ = [
    "DEFAULT_CA_PLACE_ID",
    "DEFAULT_FISH_TAXON_IDS",
    "DEFAULT_PLACE_ID",
    "DEFAULT_US_PLACE_ID",
    "FishObservation",
    "fetch_fish_near",
    "lambda_handler",
]
