"""Shared AWS SDK clients for the backend."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.core.config import settings


@lru_cache(maxsize=1)
def sagemaker_runtime_client() -> Any:
    """Returns a cached SageMaker Runtime client for the configured region."""
    import boto3

    return boto3.client("sagemaker-runtime", region_name=settings.aws_region)
