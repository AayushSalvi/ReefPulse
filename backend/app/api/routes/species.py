from fastapi import APIRouter

router = APIRouter(prefix="/species", tags=["species"])


@router.get("/{location_slug}")
def get_species_predictions(location_slug: str) -> dict[str, object]:
    return {
        "location": location_slug,
        "message": "Marine life discovery endpoint scaffolded.",
        "next_step": "Connect iNaturalist + model inference for ranked encounter probabilities.",
    }
