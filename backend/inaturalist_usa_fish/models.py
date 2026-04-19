"""Typed records returned by this package."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FishObservation:
    """One normalized fish observation near the query point.

    Attributes:
        posted_at: Submission time string from iNaturalist ``created_at`` (or ``updated_at`` fallback).
    """

    observation_id: int
    latitude: float
    longitude: float
    taxon_id: int
    image_urls: tuple[str, ...]
    taxon_name: str | None = None
    posted_at: str | None = None
