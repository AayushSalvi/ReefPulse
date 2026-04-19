"""Model A inference: local checkpoint or (later) SageMaker endpoint."""

from __future__ import annotations

from fastapi import HTTPException

from app.core.config import settings
from app.ml.model_a.inference import load_forecaster
from app.schemas.forecast import ModelAForecastRequest, ModelAForecastResponse

_cached_path: str | None = None
_cached_forecaster: object | None = None


def _get_forecaster():
    """Cache successful loads only; retry if checkpoint was missing and later appears."""
    global _cached_path, _cached_forecaster
    path = settings.model_a_artifact_path
    if not path:
        return None
    if _cached_path is not None and _cached_path != path:
        _cached_path = None
        _cached_forecaster = None
    if _cached_forecaster is not None and _cached_path == path:
        return _cached_forecaster
    f = load_forecaster(path, mc_samples=settings.model_a_mc_samples)
    if f is not None:
        _cached_path = path
        _cached_forecaster = f
    return f


def forecast_model_a(body: ModelAForecastRequest) -> ModelAForecastResponse:
    import numpy as np

    arr = np.array(body.past_series, dtype=np.float32)
    if arr.shape != (30, 4):
        raise HTTPException(
            status_code=422,
            detail=f"past_series must have shape (30, 4); got {arr.shape}",
        )

    forecaster = _get_forecaster()
    if forecaster is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Model A checkpoint not configured or failed to load. "
                "Set MODEL_A_ARTIFACT_PATH to a trained .pt file (install optional [model-a] deps)."
            ),
        )

    out = forecaster.predict(arr)
    return ModelAForecastResponse(
        forecast_mean=out["forecast_mean"],
        forecast_p10=out["forecast_p10"],
        forecast_p90=out["forecast_p90"],
        horizon_days=out["horizon_days"],
        channels=out["channels"],
        station_id=body.station_id,
        model_source="local-checkpoint:model-a" if settings.model_a_artifact_path else "model-a-unconfigured",
    )


def model_a_status() -> dict[str, object]:
    path = settings.model_a_artifact_path
    f = _get_forecaster()
    return {
        "artifact_path": path,
        "loaded": f is not None,
        "mc_samples": settings.model_a_mc_samples,
    }
