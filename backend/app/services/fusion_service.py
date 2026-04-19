from __future__ import annotations

from datetime import date, timedelta

from app.schemas.anomaly import AnomalyResponse
from app.schemas.forecast import ModelAForecastRequest
from app.schemas.fusion import FusionBriefingRequest, FusionBriefingResponse
from app.schemas.species import SpeciesRankRequest, SpeciesRankResponse
from app.services.anomaly_service import anomaly_service
from app.services.forecast_service import forecast_model_a
from app.services.species_rank_service import rank_species_with_sagemaker_fallback


def _build_past_series(latitude: float, longitude: float) -> list[list[float]]:
    temp_base = 11.0 + abs(latitude) % 7 / 3
    salinity_base = 33.2 + abs(longitude) % 8 / 50
    oxygen_base = 6.2 - (temp_base - 11.0) * 0.12
    chlorophyll_base = 0.6 + (abs(latitude + longitude) % 5) / 20
    rows: list[list[float]] = []
    for i in range(30):
        cycle = i / 29
        temp = temp_base + 0.45 * cycle
        sal = salinity_base + 0.04 * (1 - cycle)
        oxy = oxygen_base - 0.25 * cycle
        chl = chlorophyll_base + 0.12 * cycle
        rows.append([round(temp, 4), round(sal, 4), round(oxy, 4), round(chl, 4)])
    return rows


def build_fusion_briefing(payload: FusionBriefingRequest) -> FusionBriefingResponse:
    history_end = date.today()
    past_series = _build_past_series(payload.latitude, payload.longitude)
    station_id = payload.location or f"{payload.latitude:.4f},{payload.longitude:.4f}"
    forecast = forecast_model_a(
        ModelAForecastRequest(
            station_id=station_id,
            past_series=past_series,
        )
    )
    forecast_mean = forecast.forecast_mean
    if not forecast_mean:
        raise ValueError("Model A returned empty forecast_mean")

    base_forecast_date = history_end + timedelta(days=1)
    requested_date = payload.target_date or (base_forecast_date + timedelta(days=forecast.horizon_days - 1))
    day_index = min(max((requested_date - base_forecast_date).days, 0), forecast.horizon_days - 1)
    resolved_date = base_forecast_date + timedelta(days=day_index)

    selected_state = forecast_mean[day_index]
    selected_low = forecast.forecast_p10[day_index]
    selected_high = forecast.forecast_p90[day_index]
    anomaly: AnomalyResponse = anomaly_service.score(
        state_vector=selected_state,
        feature_names=forecast.channels,
    )

    species_req = SpeciesRankRequest(
        location=payload.location,
        latitude=payload.latitude,
        longitude=payload.longitude,
        top_k=payload.top_k,
        observed_date=resolved_date,
    )
    species: SpeciesRankResponse = rank_species_with_sagemaker_fallback(species_req)
    species_preview = ", ".join(p.species for p in species.predictions[:3]) or "no species ranked"
    headline = (
        f"{anomaly.severity.title()} anomaly risk for {resolved_date.isoformat()}. "
        f"Likely species include {species_preview}."
    )

    return FusionBriefingResponse(
        history={
            "deployment_id": station_id,
            "history_end": history_end.isoformat(),
            "resolved_forecast_date": resolved_date.isoformat(),
            "forecast_day_index": day_index,
            "past_series": past_series,
            "notes": [
                "History vector is currently generated from coordinate priors until mooring history ingestion is wired.",
            ],
        },
        forecast={
            "forecast_mean": forecast.forecast_mean,
            "forecast_p10": forecast.forecast_p10,
            "forecast_p90": forecast.forecast_p90,
            "horizon_days": forecast.horizon_days,
            "channels": forecast.channels,
            "station_id": forecast.station_id,
            "model_source": getattr(forecast, "model_source", "model-a"),
        },
        selected_forecast={
            "target_date": resolved_date.isoformat(),
            "day_index": day_index,
            "state_vector": selected_state,
            "lower_bound": selected_low,
            "upper_bound": selected_high,
            "channels": forecast.channels,
        },
        anomaly=anomaly.model_dump(),
        species=species.model_dump(),
        headline=headline,
    )
