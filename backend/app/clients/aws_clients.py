"""Shared AWS SDK clients for the backend."""

from __future__ import annotations

from functools import lru_cache

import boto3
from botocore.client import BaseClient

from app.core.config import settings


@lru_cache(maxsize=1)
def get_boto3_session() -> boto3.session.Session:
    return boto3.session.Session(region_name=settings.aws_region)


@lru_cache(maxsize=1)
def get_s3_client() -> BaseClient:
    return get_boto3_session().client("s3")


@lru_cache(maxsize=1)
def get_sagemaker_runtime_client() -> BaseClient:
    return get_boto3_session().client("sagemaker-runtime")


@lru_cache(maxsize=1)
def get_sns_client() -> BaseClient:
    return get_boto3_session().client("sns")


# * Same cached client as get_sagemaker_runtime_client; kept for species_service/tests.
sagemaker_runtime_client = get_sagemaker_runtime_client
