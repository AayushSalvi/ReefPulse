from __future__ import annotations

from fastapi import APIRouter

from app.schemas.fusion import FusionBriefingRequest, FusionBriefingResponse
from app.services.fusion_service import build_fusion_briefing

router = APIRouter(prefix="/fusion", tags=["fusion"])


@router.post("/briefing", response_model=FusionBriefingResponse)
def post_fusion_briefing(body: FusionBriefingRequest) -> FusionBriefingResponse:
    return build_fusion_briefing(body)
