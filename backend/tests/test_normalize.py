"""Tests for observation normalization."""

from __future__ import annotations

from inaturalist_usa_fish.normalize import observation_to_fish_record, observations_to_fish_records


def test_observation_from_geojson_point() -> None:
    obs = {
        "id": 10,
        "geojson": {"type": "Point", "coordinates": [-81.0, 25.0]},
        "taxon": {"id": 99, "name": "Species x"},
        "photos": [{"url": "https://example.com/a.jpg"}],
    }
    rec = observation_to_fish_record(obs)
    assert rec is not None
    assert rec.observation_id == 10
    assert rec.latitude == 25.0
    assert rec.longitude == -81.0
    assert rec.taxon_id == 99
    assert rec.image_urls == ("https://example.com/a.jpg",)
    assert rec.posted_at is None


def test_observation_from_location_string() -> None:
    obs = {
        "id": 2,
        "location": "24.5,-80.0",
        "taxon": {"id": 5, "name": "n", "preferred_common_name": "Common"},
        "photos": [],
    }
    rec = observation_to_fish_record(obs)
    assert rec is not None
    assert rec.latitude == 24.5
    assert rec.longitude == -80.0
    assert rec.taxon_name == "Common (n)"


def test_posted_at_from_created_at() -> None:
    obs = {
        "id": 1,
        "location": "1,2",
        "taxon": {"id": 1},
        "photos": [],
        "created_at": "2026-04-18T10:00:00-07:00",
    }
    rec = observation_to_fish_record(obs)
    assert rec is not None
    assert rec.posted_at == "2026-04-18T10:00:00-07:00"


def test_posted_at_fallback_updated_at() -> None:
    obs = {
        "id": 1,
        "location": "1,2",
        "taxon": {"id": 1},
        "photos": [],
        "updated_at": "2026-04-19T00:00:00+00:00",
    }
    rec = observation_to_fish_record(obs)
    assert rec is not None
    assert rec.posted_at == "2026-04-19T00:00:00+00:00"


def test_observation_requires_taxon() -> None:
    obs = {"id": 1, "location": "1,2"}
    assert observation_to_fish_record(obs) is None


def test_observations_to_fish_records_filters_invalid() -> None:
    rows = [
        {"id": 1, "location": "1,2", "taxon": {"id": 1}, "photos": []},
        {"id": 2},
    ]
    out = observations_to_fish_records(rows)
    assert len(out) == 1
    assert out[0].observation_id == 1
