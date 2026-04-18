from fastapi import APIRouter

router = APIRouter(prefix="/forecasts", tags=["forecasts"])


@router.get("")
def get_forecast() -> dict[str, object]:
    return {
        "message": "Forecast endpoint scaffolded.",
        "next_step": "Connect this route to the state forecaster service and NOAA/Scripps-backed features.",
    }
