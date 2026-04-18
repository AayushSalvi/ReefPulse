from fastapi import APIRouter

router = APIRouter(prefix="/safety", tags=["safety"])


@router.get("/{location_slug}")
def get_safety_index(location_slug: str) -> dict[str, object]:
    return {
        "location": location_slug,
        "message": "Surf Safety Index endpoint scaffolded.",
        "next_step": "Fuse forecasts, anomalies, HAB risk, and live conditions here.",
    }
