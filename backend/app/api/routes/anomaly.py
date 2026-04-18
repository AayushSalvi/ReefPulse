from fastapi import APIRouter

from app.schemas.anomaly import AnomalyRequest, AnomalyResponse
from app.services.anomaly_service import anomaly_service

router = APIRouter(prefix="/anomaly", tags=["anomaly"])


@router.post("/score", response_model=AnomalyResponse)
def score_anomaly(request: AnomalyRequest) -> AnomalyResponse:
    return anomaly_service.score_request(request)
