"""Presigned S3 uploads for community images."""

from __future__ import annotations

import uuid
from pathlib import Path

import boto3
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.community import MediaPresignRequest, MediaPresignResponse


_CT_TO_EXT = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def _expected_ext_for_ct(ct: str) -> str | None:
    return _CT_TO_EXT.get(ct)


def _allowed_types() -> set[str]:
    return {x.strip().lower() for x in settings.community_upload_allowed_content_types.split(",") if x.strip()}


def _ext_from_filename(filename: str) -> str:
    suf = Path(filename).suffix.lower().lstrip(".")
    if not suf:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="filename must include an extension")
    return suf


def presign_community_upload(user_id: str, body: MediaPresignRequest) -> MediaPresignResponse:
    ct = body.content_type.strip().lower()
    allowed = _allowed_types()
    if ct not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"content_type must be one of: {', '.join(sorted(allowed))}",
        )
    if body.size_bytes > settings.community_upload_max_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"size_bytes must be <= {settings.community_upload_max_bytes}",
        )
    ext = _ext_from_filename(body.filename)
    expected = _expected_ext_for_ct(ct)
    if expected:
        ok = ext == expected or (ct == "image/jpeg" and ext in ("jpg", "jpeg"))
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="filename extension does not match content_type",
            )

    prefix = settings.community_s3_key_prefix.strip().strip("/")
    key = f"{prefix}/{user_id}/{uuid.uuid4().hex}.{ext}"
    public_url = f"https://{settings.s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{key}"

    try:
        s3 = boto3.client("s3", region_name=settings.aws_region)
        upload_url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": settings.s3_bucket,
                "Key": key,
                "ContentType": body.content_type.strip(),
            },
            ExpiresIn=settings.community_presign_ttl_seconds,
        )
    except (ClientError, BotoCoreError, NoCredentialsError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"S3 presign failed: {e}",
        ) from e

    return MediaPresignResponse(
        upload_url=upload_url,
        object_key=key,
        public_url=public_url,
        expires_in=settings.community_presign_ttl_seconds,
        headers={"Content-Type": body.content_type.strip()},
    )
