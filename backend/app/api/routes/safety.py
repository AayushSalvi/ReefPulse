from typing import cast

from fastapi import APIRouter

from app.schemas.anomaly import AnomalyRequest
from app.schemas.safety import RecreationFusionRequest, RecreationFusionResponse
from app.services.safety_index_service import (
    build_recreation_fusion,
    deterministic_demo_inputs,
)

router = APIRouter(prefix="/safety", tags=["safety"])


@router.post("/recreation", response_model=RecreationFusionResponse)
def post_recreation_fusion(body: RecreationFusionRequest) -> RecreationFusionResponse:
    """Fuse Model A (14-day PatchTST-style forecast) with Model B (VAE-style anomaly) for beach UX."""
    return build_recreation_fusion(
        display_location=body.display_location,
        station_id=body.station_id,
        past_series=body.past_series,
        anomaly_request=cast(AnomalyRequest, body.anomaly),
    )


@router.get("/{location_slug}", response_model=RecreationFusionResponse)
def get_safety_index(location_slug: str) -> RecreationFusionResponse:
    """Demo fusion keyed by `location_slug` (deterministic pseudo mooring + profile)."""
    past_series, anomaly_req = deterministic_demo_inputs(location_slug)
    return build_recreation_fusion(
        display_location=location_slug,
        station_id=None,
        past_series=past_series,
        anomaly_request=anomaly_req,
    )
