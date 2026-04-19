"""Forecast API schemas (Model A state forecaster)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ModelAForecastRequest(BaseModel):
    """Last 30 days of multivariate ocean state (physical units as training data)."""

    station_id: str | None = Field(
        default=None,
        description="CalCOFI-style station id (e.g. line.sta); optional metadata for clients.",
    )
    past_series: list[list[float]] = Field(
        ...,
        description="Shape (30, 4): temp_c, salinity, oxygen_ml_l, chlorophyll_a.",
    )


class ModelAForecastResponse(BaseModel):
    forecast_mean: list[list[float]] = Field(..., description="14 x 4 point forecast.")
    forecast_p10: list[list[float]] = Field(
        ...,
        description="Lower band (~10th percentile) from MC dropout, 14 x 4.",
    )
    forecast_p90: list[list[float]] = Field(
        ...,
        description="Upper band (~90th percentile) from MC dropout, 14 x 4.",
    )
    horizon_days: int = 14
    channels: list[str]
    station_id: str | None = None
