"""Recreation safety: fused Model A (state forecaster) + Model B (anomaly / VAE-style)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.anomaly import DEFAULT_MODEL_B_FEATURES, AnomalyRequest, DrivingVariable


BeachCondition = Literal["excellent", "good", "moderate", "poor", "hazardous"]


class ModelAFusionSummary(BaseModel):
    """Compact summary of the 14-day multivariate forecast for operators and UI."""

    mean_temperature_c_forecast: float = Field(
        ...,
        description="Mean of day-ahead mean temperature over the 14-day horizon (°C).",
    )
    mean_chlorophyll_a_forecast: float = Field(
        ...,
        description="Mean chlorophyll-a (µg/L) over the horizon mean trajectory.",
    )
    min_oxygen_p10_ml_l: float = Field(
        ...,
        description="Minimum lower-band (~10th pct) dissolved oxygen across days (mL/L).",
    )
    fourteen_day_heat_trend_c: float = Field(
        ...,
        description="Late-window minus early-window mean temperature (°C), from forecast mean.",
    )
    forecast_uncertainty_proxy: float = Field(
        ...,
        description="Mean (p90−p10) for temperature across horizon; wider bands imply higher epistemic stress.",
    )


class ModelBFusionSummary(BaseModel):
    anomaly_score: float
    severity: str
    is_anomaly: bool
    model_source: str
    top_driving_variables: list[DrivingVariable] = Field(
        ...,
        description="Top contributors to reconstruction error (per-variable attribution).",
    )


class RecreationFusionRequest(BaseModel):
    """POST body: optional Model A series; Model B state via anomaly block or defaults."""

    display_location: str | None = Field(
        default=None,
        description="Human label (e.g. URL slug) stored alongside results for dashboards.",
    )
    station_id: str | None = None
    past_series: list[list[float]] | None = Field(
        default=None,
        description="Shape (30, 4): temp_c, salinity, oxygen_ml_l, chlorophyll_a for Model A.",
    )
    anomaly: AnomalyRequest | None = Field(
        default=None,
        description="If omitted, a neutral 16-feature vector (DEFAULT_MODEL_B_FEATURES order) is used.",
    )

    @model_validator(mode="after")
    def default_anomaly(self) -> RecreationFusionRequest:
        if self.anomaly is not None:
            return self
        # Mild “typical spring coastal” profile so the heuristic VAE is near baseline.
        neutral = [
            13.5,
            13.2,
            13.0,
            12.8,
            33.4,
            33.5,
            33.6,
            33.7,
            5.2,
            5.0,
            4.8,
            4.5,
            0.9,
            0.6,
            0.4,
            0.3,
        ]
        if len(neutral) != len(DEFAULT_MODEL_B_FEATURES):
            raise ValueError("neutral template length must match DEFAULT_MODEL_B_FEATURES")
        return self.model_copy(update={"anomaly": AnomalyRequest(state_vector=neutral)})


class RecreationFusionResponse(BaseModel):
    safety_index: int = Field(..., ge=0, le=100)
    beach_condition: BeachCondition
    narrative: str
    display_location: str | None = None
    station_id: str | None = None
    model_a_used: bool
    model_a_unavailable_reason: str | None = None
    model_a_summary: ModelAFusionSummary | None = None
    model_b: ModelBFusionSummary
    public_flags: dict[str, bool] = Field(
        ...,
        description="Heatwave / hypoxia / bloom / stratification heuristics for beach boards.",
    )
    fusion_method: str = Field(
        default="forecast_penalty_plus_anomaly_severity_clamped_0_100",
        description="Version tag for reproducibility when tuning fusion weights.",
    )
