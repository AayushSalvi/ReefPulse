"""Geographic helpers for bounding-box queries."""

from __future__ import annotations

import math


def bbox_from_lat_lon_radius_km(
    latitude: float,
    longitude: float,
    radius_km: float,
) -> tuple[float, float, float, float]:
    """Build a WGS84 bounding box around a point for iNaturalist ``swlat`` … ``nelng`` params.

    Uses a degree-length approximation suitable for small radii (tens of km). Accuracy
    degrades near poles and for very large radii.

    Args:
        latitude: Center latitude in decimal degrees.
        longitude: Center longitude in decimal degrees.
        radius_km: Half-edge extent from the center in kilometers (not spherical cap radius).

    Returns:
        Tuple ``(swlat, swlng, nelat, nelng)`` in decimal degrees, clamped to valid ranges.
    """
    if radius_km <= 0:
        raise ValueError("radius_km must be positive.")
    km_per_deg_lat = 111.32
    delta_lat = radius_km / km_per_deg_lat
    cos_lat = math.cos(math.radians(latitude))
    cos_lat = max(cos_lat, 0.01)
    delta_lon = radius_km / (km_per_deg_lat * cos_lat)

    swlat = max(-90.0, latitude - delta_lat)
    nelat = min(90.0, latitude + delta_lat)
    swlng = max(-180.0, longitude - delta_lon)
    nelng = min(180.0, longitude + delta_lon)
    return swlat, swlng, nelat, nelng
