"""Tests for bounding-box helpers."""

from __future__ import annotations

import pytest

from inaturalist_usa_fish.geo import bbox_from_lat_lon_radius_km


def test_bbox_centered() -> None:
    swlat, swlng, nelat, nelng = bbox_from_lat_lon_radius_km(0.0, 0.0, 111.32)
    assert swlat < 0 < nelat
    assert swlng < 0 < nelng


def test_bbox_rejects_nonpositive_radius() -> None:
    with pytest.raises(ValueError):
        bbox_from_lat_lon_radius_km(0.0, 0.0, 0.0)
