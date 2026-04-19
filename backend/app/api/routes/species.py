from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.schemas.species import SpeciesRankRequest, SpeciesRankResponse
from app.services import species_service
from app.services.species_rank_service import rank_for_slug, rank_species

router = APIRouter(prefix="/species", tags=["species"])


@router.post("/rank", response_model=SpeciesRankResponse)
def post_species_rank(body: SpeciesRankRequest) -> SpeciesRankResponse:
    """Rank species encounters for a coordinate + context (fishdeck backend)."""
    return rank_species(body)


@router.get("/status")
def get_species_status() -> dict[str, object]:
    return {
        "species_rank_model": "deterministic-demo-v1",
        "ready": True,
        "endpoints": ["/species/rank", "/species/{location_slug}"],
    }


@router.get("/{location_slug}")
def get_species_predictions(
    location_slug: str,
    lat: float | None = Query(
        None,
        description="Latitude (WGS84). With `lon`, calls the SageMaker ranked-fish model.",
    ),
    lon: float | None = Query(
        None,
        description="Longitude (WGS84). With `lat`, calls the SageMaker ranked-fish model.",
    ),
    date: str | None = Query(
        None,
        description="Observation date YYYY-MM-DD; omit to let the model default.",
    ),
    top_k: int = Query(10, ge=1, le=100, description="Number of ranked species to return."),
) -> dict[str, Any] | SpeciesRankResponse:
    """Slug-only GET uses the demo ranker; `lat`+`lon` use SageMaker (Model D) for any slug."""
    if location_slug in {"rank", "status"}:
        raise HTTPException(status_code=404, detail="Not found")
    if lat is not None and lon is not None:
        result = species_service.ranked_species_near(
            latitude=lat,
            longitude=lon,
            observation_date=date,
            top_k=top_k,
        )
        return {"location_slug": location_slug, **result}
    demo_top_k = min(top_k, 10)
    out = rank_for_slug(location_slug, top_k=demo_top_k)
    if out is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Unknown location_slug '{location_slug}'. "
                "Pass lat and lon for ranked predictions, try a known beach slug, "
                "or POST /species/rank with coordinates."
            ),
        )
    return out
