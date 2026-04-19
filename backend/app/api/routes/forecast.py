from fastapi import APIRouter

from app.schemas.forecast import ModelAForecastRequest, ModelAForecastResponse
from app.services import forecast_service

router = APIRouter(prefix="/forecasts", tags=["forecasts"])


@router.get("")
def get_forecast() -> dict[str, object]:
    return {
        "message": "Use POST /forecasts/model-a with 30x4 past_series for Model A.",
        "model_a": "/forecasts/model-a",
    }


@router.post("/model-a", response_model=ModelAForecastResponse)
def post_model_a_forecast(body: ModelAForecastRequest) -> ModelAForecastResponse:
    """14-day multivariate forecast with MC-dropout uncertainty bands."""
    return forecast_service.forecast_model_a(body)


@router.get("/model-a/status")
def get_model_a_status() -> dict[str, object]:
    return forecast_service.model_a_status()
