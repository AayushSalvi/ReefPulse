"""Ranked marine species predictions via the deployed SageMaker fish model."""

from __future__ import annotations

import logging
from typing import Any

from botocore.exceptions import ClientError
from fastapi import HTTPException

from app.clients.aws_clients import sagemaker_runtime_client
from app.ml import inference_router, model_registry

logger = logging.getLogger(__name__)


def ranked_species_near(
    *,
    latitude: float,
    longitude: float,
    observation_date: str | None,
    top_k: int,
) -> dict[str, Any]:
    """Calls the CA-coast ranked fish predictor on SageMaker."""
    payload: dict[str, Any] = {
        "latitude": latitude,
        "longitude": longitude,
        "top_k": top_k,
    }
    if observation_date:
        payload["date"] = observation_date

    endpoint_name = model_registry.endpoint_for(model_registry.SPECIES_FISH_RANKED)
    try:
        return inference_router.invoke_sagemaker_json(
            client=sagemaker_runtime_client(),
            endpoint_name=endpoint_name,
            payload=payload,
        )
    except ClientError as exc:
        logger.exception("SageMaker species inference failed")
        code = exc.response.get("Error", {}).get("Code", "")
        status = 503 if code in {"ModelError", "ServiceUnavailable"} else 502
        raise HTTPException(
            status_code=status,
            detail="Species model is unavailable. Check the SageMaker endpoint and IAM permissions.",
        ) from exc
