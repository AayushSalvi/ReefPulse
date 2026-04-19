"""Route inference (Model A local / SageMaker JSON); extend per endpoint type."""

from __future__ import annotations

import json
from typing import Any

from app.ml.model_a.inference import load_forecaster


def invoke_sagemaker_json(
    *,
    client: Any,
    endpoint_name: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Invokes a SageMaker endpoint that accepts and returns JSON."""
    response = client.invoke_endpoint(
        EndpointName=endpoint_name,
        ContentType="application/json",
        Accept="application/json",
        Body=json.dumps(payload).encode("utf-8"),
    )
    body = response["Body"].read().decode("utf-8")
    parsed: dict[str, Any] = json.loads(body)
    return parsed


__all__ = ["invoke_sagemaker_json", "load_forecaster"]
