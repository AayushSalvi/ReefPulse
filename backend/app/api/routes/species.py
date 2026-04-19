from typing import Any

from fastapi import APIRouter, Query

from app.services import species_service

router = APIRouter(prefix="/species", tags=["species"])


@router.get("/{location_slug}")
def get_species_predictions(
    location_slug: str,
    lat: float = Query(..., description="Latitude (WGS84)."),
    lon: float = Query(..., description="Longitude (WGS84)."),
    date: str | None = Query(
        None,
        description="Observation date YYYY-MM-DD; omit to let the model default.",
    ),
    top_k: int = Query(10, ge=1, le=100, description="Number of ranked species to return."),
) -> dict[str, Any]:
    """Returns ranked fish encounter probabilities for a coordinate and date."""
    result = species_service.ranked_species_near(
        latitude=lat,
        longitude=lon,
        observation_date=date,
        top_k=top_k,
    )
    return {"location_slug": location_slug, **result}
