"""HTTP client for iNaturalist observations search."""

from __future__ import annotations

import time
from typing import Any, Iterator

import httpx

from inaturalist_usa_fish.config import (
    API_BASE_URL,
    DEFAULT_FISH_TAXON_IDS,
    DEFAULT_PLACE_ID,
    DEFAULT_USER_AGENT,
    MAX_PER_PAGE,
)
from inaturalist_usa_fish.geo import bbox_from_lat_lon_radius_km


def _taxon_id_param(taxon_ids: tuple[int, ...]) -> str:
    return ",".join(str(t) for t in taxon_ids)


def iter_observation_pages(
    *,
    swlat: float,
    swlng: float,
    nelat: float,
    nelng: float,
    place_id: int = DEFAULT_PLACE_ID,
    taxon_ids: tuple[int, ...] = DEFAULT_FISH_TAXON_IDS,
    photos: bool = True,
    geo: bool = True,
    quality_grade: str | None = "research",
    per_page: int = 50,
    max_pages: int | None = None,
    page_sleep_seconds: float = 0.0,
    client: httpx.Client | None = None,
    base_url: str = API_BASE_URL,
    user_agent: str = DEFAULT_USER_AGENT,
) -> Iterator[list[dict[str, Any]]]:
    """Yield raw ``results`` lists from ``GET /observations`` for each page.

    Args:
        swlat: Southwest bounding-box latitude.
        swlng: Southwest bounding-box longitude.
        nelat: Northeast bounding-box latitude.
        nelng: Northeast bounding-box longitude.
        place_id: iNaturalist place id (default: California, US).
        taxon_ids: Root taxon ids (comma-separated in the request).
        photos: Require observations that have photos.
        geo: Request public geographic details when available.
        quality_grade: Filter by quality grade; ``None`` disables the filter.
        per_page: Page size (capped at ``MAX_PER_PAGE``).
        max_pages: Maximum number of pages to fetch; ``None`` means no extra cap beyond the API.
        page_sleep_seconds: Optional delay between page requests.
        client: Optional shared :class:`httpx.Client` (caller owns lifecycle when provided).
        base_url: API base URL.
        user_agent: HTTP User-Agent header value.

    Yields:
        Each page's ``results`` list (possibly empty).
    """
    if per_page < 1 or per_page > MAX_PER_PAGE:
        raise ValueError(f"per_page must be between 1 and {MAX_PER_PAGE}.")

    params: dict[str, Any] = {
        "swlat": swlat,
        "swlng": swlng,
        "nelat": nelat,
        "nelng": nelng,
        "place_id": place_id,
        "taxon_id": _taxon_id_param(taxon_ids),
        "photos": photos,
        "geo": geo,
        "per_page": per_page,
    }
    if quality_grade is not None:
        params["quality_grade"] = quality_grade

    headers = {"User-Agent": user_agent}
    own_client = client is None
    http = client or httpx.Client(headers=headers, timeout=60.0)

    page = 1
    pages_fetched = 0
    try:
        while True:
            if max_pages is not None and pages_fetched >= max_pages:
                break
            params["page"] = page
            response = http.get(f"{base_url}/observations", params=params)
            response.raise_for_status()
            payload = response.json()
            results = payload.get("results") or []
            if not isinstance(results, list):
                break
            pages_fetched += 1
            yield results
            if not results:
                break
            page += 1
            if page_sleep_seconds > 0:
                time.sleep(page_sleep_seconds)
    finally:
        if own_client:
            http.close()


def fetch_observations_near(
    latitude: float,
    longitude: float,
    *,
    radius_km: float = 25.0,
    place_id: int = DEFAULT_PLACE_ID,
    taxon_ids: tuple[int, ...] = DEFAULT_FISH_TAXON_IDS,
    photos: bool = True,
    geo: bool = True,
    quality_grade: str | None = "research",
    per_page: int = 50,
    max_pages: int | None = 10,
    page_sleep_seconds: float = 0.0,
    client: httpx.Client | None = None,
    base_url: str = API_BASE_URL,
    user_agent: str = DEFAULT_USER_AGENT,
) -> list[dict[str, Any]]:
    """Fetch all observation dicts near a point, concatenating pages up to ``max_pages``."""
    swlat, swlng, nelat, nelng = bbox_from_lat_lon_radius_km(latitude, longitude, radius_km)
    combined: list[dict[str, Any]] = []
    for page_results in iter_observation_pages(
        swlat=swlat,
        swlng=swlng,
        nelat=nelat,
        nelng=nelng,
        place_id=place_id,
        taxon_ids=taxon_ids,
        photos=photos,
        geo=geo,
        quality_grade=quality_grade,
        per_page=per_page,
        max_pages=max_pages,
        page_sleep_seconds=page_sleep_seconds,
        client=client,
        base_url=base_url,
        user_agent=user_agent,
    ):
        combined.extend(page_results)
    return combined
