"""Map iNaturalist observation JSON into :class:`FishObservation`."""

from __future__ import annotations

from typing import Any

from inaturalist_usa_fish.models import FishObservation


def _parse_latitude_longitude(observation: dict[str, Any]) -> tuple[float, float] | None:
    """Extract decimal latitude and longitude from an observation payload."""
    lat = observation.get("latitude")
    lon = observation.get("longitude")
    if lat is not None and lon is not None:
        return float(lat), float(lon)

    location = observation.get("location")
    if isinstance(location, str) and "," in location:
        parts = location.split(",")
        if len(parts) >= 2:
            try:
                return float(parts[0].strip()), float(parts[1].strip())
            except ValueError:
                pass

    geojson = observation.get("geojson")
    if isinstance(geojson, dict) and geojson.get("type") == "Point":
        coords = geojson.get("coordinates")
        if isinstance(coords, (list, tuple)) and len(coords) >= 2:
            lon_c, lat_c = float(coords[0]), float(coords[1])
            return lat_c, lon_c

    return None


def _taxon_id_from_observation(observation: dict[str, Any]) -> int | None:
    """Return the community-identified taxon id when available."""
    taxon = observation.get("taxon")
    if isinstance(taxon, dict) and taxon.get("id") is not None:
        return int(taxon["id"])
    if observation.get("community_taxon_id") is not None:
        return int(observation["community_taxon_id"])
    if observation.get("taxon_id") is not None:
        return int(observation["taxon_id"])
    return None


def _taxon_name(observation: dict[str, Any]) -> str | None:
    """Return a display name for the taxon, if present."""
    taxon = observation.get("taxon")
    if not isinstance(taxon, dict):
        return None
    name = taxon.get("name")
    preferred = taxon.get("preferred_common_name")
    if preferred and name:
        return f"{preferred} ({name})"
    if name:
        return str(name)
    if preferred:
        return str(preferred)
    return None


def _posted_at(observation: dict[str, Any]) -> str | None:
    """Return ISO8601-ish submission time from the API (``created_at``)."""
    created = observation.get("created_at")
    if isinstance(created, str) and created.strip():
        return created.strip()
    updated = observation.get("updated_at")
    if isinstance(updated, str) and updated.strip():
        return updated.strip()
    return None


def _image_urls(observation: dict[str, Any]) -> tuple[str, ...]:
    """Collect photo URLs from the observation."""
    photos = observation.get("photos")
    if not isinstance(photos, list):
        return ()
    urls: list[str] = []
    for photo in photos:
        if not isinstance(photo, dict):
            continue
        url = photo.get("url")
        if isinstance(url, str) and url:
            urls.append(url)
    return tuple(urls)


def observation_to_fish_record(observation: dict[str, Any]) -> FishObservation | None:
    """Convert a single API observation dict into :class:`FishObservation`, or ``None`` if unusable."""
    coords = _parse_latitude_longitude(observation)
    if coords is None:
        return None
    lat, lon = coords

    taxon_id = _taxon_id_from_observation(observation)
    if taxon_id is None:
        return None

    obs_id = observation.get("id")
    if obs_id is None:
        return None

    return FishObservation(
        observation_id=int(obs_id),
        latitude=lat,
        longitude=lon,
        taxon_id=taxon_id,
        image_urls=_image_urls(observation),
        taxon_name=_taxon_name(observation),
        posted_at=_posted_at(observation),
    )


def observations_to_fish_records(observations: list[dict[str, Any]]) -> list[FishObservation]:
    """Convert a list of observation dicts, skipping entries that cannot be normalized."""
    out: list[FishObservation] = []
    for obs in observations:
        if not isinstance(obs, dict):
            continue
        rec = observation_to_fish_record(obs)
        if rec is not None:
            out.append(rec)
    return out
