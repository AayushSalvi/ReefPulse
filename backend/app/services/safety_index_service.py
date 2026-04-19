"""Fuse Model A (PatchTST-style forecaster) and Model B (VAE-style anomaly) into recreation metrics."""

from __future__ import annotations

import hashlib
import random
from fastapi import HTTPException

from app.schemas.anomaly import AnomalyRequest, AnomalyResponse, DrivingVariable
from app.schemas.forecast import ModelAForecastRequest, ModelAForecastResponse
from app.schemas.safety import (
    BeachCondition,
    ModelAFusionSummary,
    ModelBFusionSummary,
    RecreationFusionResponse,
)
from app.services.anomaly_service import anomaly_service
from app.services.forecast_service import forecast_model_a

_IDX_TEMP = 0
_IDX_CHL = 3
_IDX_OXY = 2


def _band_width_temp(row_mean: list[float], row_p10: list[float], row_p90: list[float]) -> float:
    return float(row_p90[_IDX_TEMP] - row_p10[_IDX_TEMP])


def summarize_model_a(forecast: ModelAForecastResponse) -> ModelAFusionSummary:
    fm = forecast.forecast_mean
    p10 = forecast.forecast_p10
    p90 = forecast.forecast_p90
    mean_t = sum(row[_IDX_TEMP] for row in fm) / len(fm)
    mean_chl = sum(row[_IDX_CHL] for row in fm) / len(fm)
    min_o2_p10 = min(row[_IDX_OXY] for row in p10)
    early_t = sum(fm[i][_IDX_TEMP] for i in range(min(2, len(fm)))) / min(2, len(fm))
    late_t = sum(fm[i][_IDX_TEMP] for i in range(max(0, len(fm) - 2), len(fm))) / min(2, len(fm))
    heat_trend = late_t - early_t
    unc = sum(_band_width_temp(fm[i], p10[i], p90[i]) for i in range(len(fm))) / len(fm)
    return ModelAFusionSummary(
        mean_temperature_c_forecast=mean_t,
        mean_chlorophyll_a_forecast=mean_chl,
        min_oxygen_p10_ml_l=min_o2_p10,
        fourteen_day_heat_trend_c=heat_trend,
        forecast_uncertainty_proxy=unc,
    )


def _forecast_penalty_points(summary: ModelAFusionSummary) -> float:
    """Map forecast stress to 0–35 points subtracted from a nominal 100 base."""
    penalty = 0.0
    if summary.mean_chlorophyll_a_forecast > 1.5:
        penalty += min(12.0, (summary.mean_chlorophyll_a_forecast - 1.5) * 6.0)
    if summary.min_oxygen_p10_ml_l < 4.0:
        penalty += min(14.0, (4.0 - summary.min_oxygen_p10_ml_l) * 5.0)
    if summary.fourteen_day_heat_trend_c > 1.0:
        penalty += min(10.0, (summary.fourteen_day_heat_trend_c - 1.0) * 6.0)
    if summary.forecast_uncertainty_proxy > 2.5:
        penalty += min(6.0, (summary.forecast_uncertainty_proxy - 2.5) * 2.0)
    return min(35.0, penalty)


def _anomaly_penalty_points(severity: str) -> float:
    if severity == "high":
        return 28.0
    if severity == "elevated":
        return 12.0
    return 0.0


def _beach_band(score: int) -> BeachCondition:
    if score >= 85:
        return "excellent"
    if score >= 70:
        return "good"
    if score >= 55:
        return "moderate"
    if score >= 40:
        return "poor"
    return "hazardous"


def _narrative(
    *,
    beach: BeachCondition,
    flags: dict[str, bool],
    model_a_used: bool,
    severity: str,
) -> str:
    parts: list[str] = []
    if beach in {"excellent", "good"}:
        parts.append("Overall conditions look favorable for typical nearshore recreation.")
    elif beach == "moderate":
        parts.append("Elevated ocean variability or anomalies warrant extra caution.")
    else:
        parts.append("Several ocean stress signals align; consider limiting exposure or checking official advisories.")
    if flags.get("marine_heatwave_risk"):
        parts.append("Warm-layer trend or temperature anomalies suggest heatwave-type stress.")
    if flags.get("hypoxia_risk"):
        parts.append("Low-oxygen signals appear in the forecast or anomaly attribution.")
    if flags.get("bloom_risk"):
        parts.append("Chlorophyll signals suggest possible bloom or reduced water clarity.")
    if flags.get("strong_stratification_risk"):
        parts.append("Strong vertical structure in temperature/salinity may affect mixing and local conditions.")
    if not model_a_used:
        parts.append("Short-range forecast fusion used anomaly-only priors where Model A was unavailable.")
    if severity == "high":
        parts.append("Model B flags a high-severity departure from normal ocean states.")
    return " ".join(parts)


def _state_map_from_anomaly_request(req: AnomalyRequest) -> dict[str, float]:
    names, vec = req.to_feature_vector()
    return dict(zip(names, vec, strict=True))


def _public_flags(
    *,
    summary: ModelAFusionSummary | None,
    anomaly: AnomalyResponse,
    state_map: dict[str, float],
) -> dict[str, bool]:
    top = anomaly.driving_variables[:5]
    top3 = anomaly.driving_variables[:3]

    heatwave_risk = False
    hypoxia_risk = False
    bloom_risk = False
    strat_risk = False

    if summary is not None:
        if summary.fourteen_day_heat_trend_c > 1.2 or summary.mean_temperature_c_forecast > 18.5:
            heatwave_risk = True
        if summary.min_oxygen_p10_ml_l < 3.8:
            hypoxia_risk = True
        if summary.mean_chlorophyll_a_forecast > 1.8:
            bloom_risk = True

    if anomaly.severity != "normal" and top3:
        lead = top3[0].feature
        if lead.startswith("temperature"):
            heatwave_risk = True
        if lead.startswith("oxygen"):
            hypoxia_risk = True
        if lead.startswith("chlorophyll"):
            bloom_risk = True

    for dv in top:
        if dv.feature.startswith("oxygen") and dv.absolute_error > 0.35:
            hypoxia_risk = True
        if dv.feature.startswith("chlorophyll") and dv.absolute_error > 0.25:
            bloom_risk = True

    t10 = state_map.get("temperature_10m")
    t200 = state_map.get("temperature_200m")
    s10 = state_map.get("salinity_10m")
    s200 = state_map.get("salinity_200m")
    if t10 is not None and t200 is not None and abs(t10 - t200) > 3.5:
        strat_risk = True
    if s10 is not None and s200 is not None and abs(s10 - s200) > 0.6:
        strat_risk = True

    return {
        "marine_heatwave_risk": heatwave_risk,
        "hypoxia_risk": hypoxia_risk,
        "bloom_risk": bloom_risk,
        "strong_stratification_risk": strat_risk,
    }


def _model_b_summary(anomaly: AnomalyResponse) -> ModelBFusionSummary:
    top = anomaly.driving_variables[:5]
    return ModelBFusionSummary(
        anomaly_score=anomaly.anomaly_score,
        severity=anomaly.severity,
        is_anomaly=anomaly.is_anomaly,
        model_source=anomaly.model_source,
        top_driving_variables=top,
    )


def build_recreation_fusion(
    *,
    display_location: str | None,
    station_id: str | None,
    past_series: list[list[float]] | None,
    anomaly_request: AnomalyRequest,
) -> RecreationFusionResponse:
    model_a: ModelAForecastResponse | None = None
    model_a_reason: str | None = None
    if past_series is not None:
        try:
            model_a = forecast_model_a(
                ModelAForecastRequest(station_id=station_id, past_series=past_series)
            )
        except HTTPException as exc:
            if exc.status_code == 503:
                model_a_reason = str(exc.detail)
            else:
                raise

    anomaly = anomaly_service.score_request(anomaly_request)
    state_map = _state_map_from_anomaly_request(anomaly_request)

    ma_summary = summarize_model_a(model_a) if model_a is not None else None
    penalty = 0.0
    if ma_summary is not None:
        penalty += _forecast_penalty_points(ma_summary)
    penalty += _anomaly_penalty_points(anomaly.severity)

    raw = 100.0 - penalty
    safety_index = int(max(0, min(100, round(raw))))
    beach = _beach_band(safety_index)
    flags = _public_flags(summary=ma_summary, anomaly=anomaly, state_map=state_map)
    narrative = _narrative(
        beach=beach,
        flags=flags,
        model_a_used=model_a is not None,
        severity=anomaly.severity,
    )

    return RecreationFusionResponse(
        safety_index=safety_index,
        beach_condition=beach,
        narrative=narrative,
        display_location=display_location,
        station_id=station_id,
        model_a_used=model_a is not None,
        model_a_unavailable_reason=model_a_reason,
        model_a_summary=ma_summary,
        model_b=_model_b_summary(anomaly),
        public_flags=flags,
    )


def deterministic_demo_inputs(location_slug: str) -> tuple[list[list[float]], AnomalyRequest]:
    """Stable pseudo-telemetry for GET demos keyed by location slug."""
    digest = hashlib.sha256(location_slug.encode("utf-8")).digest()
    seed = int.from_bytes(digest[:8], "big") % (2**32)
    rng = random.Random(seed)
    base_temp = 13.5 + rng.random() * 3.5
    series: list[list[float]] = []
    for day in range(30):
        drift = day * 0.015
        series.append(
            [
                base_temp + drift + rng.gauss(0, 0.25),
                33.5 + rng.gauss(0, 0.08),
                max(2.5, 5.5 + rng.gauss(0, 0.25)),
                max(0.05, 0.75 + abs(rng.gauss(0, 0.15))),
            ]
        )
    vec = [
        13.5 + rng.gauss(0, 0.4),
        13.2 + rng.gauss(0, 0.4),
        13.0 + rng.gauss(0, 0.4),
        12.8 + rng.gauss(0, 0.4),
        33.4 + rng.gauss(0, 0.05),
        33.5 + rng.gauss(0, 0.05),
        33.6 + rng.gauss(0, 0.05),
        33.7 + rng.gauss(0, 0.05),
        5.2 + rng.gauss(0, 0.2),
        5.0 + rng.gauss(0, 0.2),
        4.8 + rng.gauss(0, 0.2),
        4.5 + rng.gauss(0, 0.2),
        0.9 + abs(rng.gauss(0, 0.15)),
        0.6 + abs(rng.gauss(0, 0.1)),
        0.4 + abs(rng.gauss(0, 0.08)),
        0.3 + abs(rng.gauss(0, 0.06)),
    ]
    return series, AnomalyRequest(state_vector=vec)
