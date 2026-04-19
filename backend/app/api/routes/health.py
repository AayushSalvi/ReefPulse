from __future__ import annotations

import os

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
def healthcheck() -> dict[str, object]:
    """Health endpoint with model config snapshot for frontend contract checks."""
    creds_present = bool((os.getenv("AWS_ACCESS_KEY_ID") or "").strip()) and bool(
        (os.getenv("AWS_SECRET_ACCESS_KEY") or "").strip()
    )
    return {
        "status": "healthy",
        "service": settings.app_name,
        "environment": settings.environment,
        "models": {
            "forecast": {
                "enabled": True,
                "mode": "local-checkpoint" if settings.model_a_artifact_path else "unconfigured",
                "endpoint_name": settings.sagemaker_endpoint_forecast,
                "region": settings.aws_region,
                "cross_account_credentials_present": creds_present,
                "local_checkpoint_loaded": bool(settings.model_a_artifact_path),
                "mc_samples": settings.model_a_mc_samples,
            },
            "anomaly": {
                "enabled": True,
                "mode": "sagemaker-or-local",
                "endpoint_name": settings.sagemaker_endpoint_anomaly,
            },
            "species": {
                "enabled": True,
                "mode": "sagemaker-with-demo-fallback",
                "endpoint_name": settings.sagemaker_endpoint_species,
                "region": settings.aws_region,
                "cross_account_credentials_present": creds_present,
            },
        },
    }
