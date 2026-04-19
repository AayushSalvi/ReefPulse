from fastapi import APIRouter

from app.schemas.anomaly import AnomalyResponse
from app.schemas.forecast import ModelAForecastRequest, ModelAForecastResponse
from app.services.anomaly_service import anomaly_service
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


@router.post("/model-a/cascade")
def post_model_a_cascade(body: ModelAForecastRequest) -> dict[str, object]:
    forecast = forecast_service.forecast_model_a(body)
    daily_anomalies: list[dict[str, object]] = []
    for row in forecast.forecast_mean:
        scored: AnomalyResponse = anomaly_service.score(
            state_vector=row,
            feature_names=forecast.channels,
        )
        daily_anomalies.append(scored.model_dump())
    summary = daily_anomalies[-1] if daily_anomalies else {}
    return {
        "forecast": forecast.model_dump(),
        "daily_anomalies": daily_anomalies,
        "summary_anomaly": summary,
        "mapping_note": "Cascade uses shared 4-channel daily state vector from Model A into Model B.",
    }


@router.get("/model-a/status")
def get_model_a_status() -> dict[str, object]:
    return forecast_service.model_a_status()
