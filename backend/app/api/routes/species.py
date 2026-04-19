from fastapi import APIRouter, HTTPException, Query

from app.schemas.species import SpeciesRankRequest, SpeciesRankResponse
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


@router.get("/{location_slug}", response_model=SpeciesRankResponse)
def get_species_predictions(
    location_slug: str,
    top_k: int = Query(10, ge=1, le=10),
) -> SpeciesRankResponse:
    """GET fishdeck-style predictions for a known ReefPulse beach slug (mirrors frontend ids)."""
    if location_slug in {"rank", "status"}:
        raise HTTPException(status_code=404, detail="Not found")
    out = rank_for_slug(location_slug, top_k=top_k)
    if out is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown location_slug '{location_slug}'. POST /species/rank with coordinates instead.",
        )
    return out
