from fastapi import APIRouter

from app.schemas.species import (
    SpeciesPredictionsResponse,
    SpeciesRankRequest,
    SpeciesRankResponse,
    SpeciesStatusResponse,
)
from app.services.species_ranking_service import (
    predictions_for_slug,
    rank_with_client_order,
    species_status,
)

router = APIRouter(prefix="/species", tags=["species"])


@router.get("/status", response_model=SpeciesStatusResponse)
def get_species_status() -> SpeciesStatusResponse:
    """Health for species ranking stack (Model B anomaly available)."""
    ready, source = species_status()
    return SpeciesStatusResponse(
        species_api="ok",
        anomaly_ready=ready,
        anomaly_model_source=source,
    )


@router.post("/rank", response_model=SpeciesRankResponse)
def post_species_rank(body: SpeciesRankRequest) -> SpeciesRankResponse:
    """
    Persist-free rank pass: accepts client species order for a slug and returns
    ranks + encounter-style percentages (still informed by anomaly magnitude).
    """
    return rank_with_client_order(body.location_slug, body.species_order)


@router.get("/{location_slug}", response_model=SpeciesPredictionsResponse)
def get_species_predictions(location_slug: str) -> SpeciesPredictionsResponse:
    """Ranked species for a beach slug, ordered using Model B anomaly context."""
    return predictions_for_slug(location_slug)
