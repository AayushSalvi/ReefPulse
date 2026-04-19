"""AWS Lambda entrypoint with API Gateway–compatible responses."""

from __future__ import annotations

import json
import logging
import os
import traceback
from dataclasses import asdict
from typing import Any, Mapping

from inaturalist_usa_fish.config import DEFAULT_PLACE_ID

logger = logging.getLogger(__name__)
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

_JSON_HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
}


def _cors_headers() -> dict[str, str]:
    """Return CORS headers when CORS_ORIGIN is set (e.g. ``*`` or ``https://app.example``)."""
    origin = os.environ.get("CORS_ORIGIN")
    if not origin:
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
    }


def _response(
    status_code: int,
    payload: Mapping[str, Any],
    *,
    extra_headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Build an API Gateway proxy / Lambda Function URL style response."""
    headers = {**_JSON_HEADERS, **_cors_headers(), **(extra_headers or {})}
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": json.dumps(payload, default=str),
    }


def _first(params: Mapping[str, Any] | None, *keys: str) -> str | None:
    if not params:
        return None
    lower = {k.lower(): v for k, v in params.items() if k is not None}
    for key in keys:
        v = lower.get(key.lower())
        if v is not None and v != "":
            return str(v)
    return None


def _parse_event_parameters(event: Mapping[str, Any] | None) -> dict[str, Any]:
    """Extract query parameters from API Gateway v1/v2, Function URL, or direct invocation."""
    if event is None:
        return {}

    # * Direct invocation: {"lat": "32", "lon": "-117", ...}
    if "lat" in event or "latitude" in event:
        return dict(event)

    # * API Gateway HTTP API v2, Function URL (similar shape)
    qv2 = event.get("queryStringParameters")
    if isinstance(qv2, dict):
        return dict(qv2)

    # * REST API v1: nested queryStringParameters may be null
    qv1 = event.get("queryStringParameters")
    if isinstance(qv1, dict):
        return dict(qv1)

    # * Body JSON (POST)
    body = event.get("body")
    if isinstance(body, str) and body.strip():
        try:
            parsed = json.loads(body)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    return {}


def _float_param(params: Mapping[str, Any], *keys: str, default: float | None = None) -> float | None:
    raw = _first(params, *keys)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        raise ValueError(f"Invalid number for parameter {keys[0]!r}: {raw!r}") from None


def _int_param(params: Mapping[str, Any], *keys: str, default: int | None = None) -> int | None:
    raw = _first(params, *keys)
    if raw is None:
        return default
    try:
        return int(float(raw))
    except ValueError:
        raise ValueError(f"Invalid integer for parameter {keys[0]!r}: {raw!r}") from None


def lambda_handler(event: Mapping[str, Any] | None, context: Any) -> dict[str, Any]:
    """Lambda handler: fetch fish near ``lat``/``lon`` and return an API Gateway–compatible response.

    Query parameters (query string, JSON body, or direct-invoke dict keys):

    - ``lat`` / ``latitude`` (required)
    - ``lon`` / ``lng`` / ``longitude`` (required)
    - ``radius_km`` (optional, default ``25``)
    - ``per_page`` (optional)
    - ``max_pages`` (optional)
    - ``place_id`` (optional; default California ``14``; use ``1`` for entire US)
    - ``quality_grade`` (optional; use ``any`` to disable filter)

    Args:
        event: API Gateway proxy event, Function URL event, or plain dict for direct invoke.
        context: Lambda context (unused).

    Returns:
        Dict with ``statusCode``, ``headers``, and string ``body`` (JSON) for proxy integrations.
    """
    # * OPTIONS for CORS preflight
    http_method = None
    if isinstance(event, dict):
        http_method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method")
    if http_method == "OPTIONS":
        opt_headers = {**_cors_headers()}
        if not opt_headers:
            opt_headers = {"Content-Type": "application/json; charset=utf-8"}
        return {"statusCode": 204, "headers": opt_headers, "body": ""}

    try:
        params = _parse_event_parameters(event)
        lat = _float_param(params, "lat", "latitude")
        lon = _float_param(params, "lon", "lng", "longitude")
        if lat is None or lon is None:
            return _response(
                400,
                {"error": "missing_parameters", "message": "Provide lat and lon (or latitude and longitude)."},
            )

        radius = _float_param(params, "radius_km", default=25.0)
        if radius is None:
            radius = 25.0
        per_page = _int_param(params, "per_page", default=50)
        max_pages = _int_param(params, "max_pages", default=10)
        place_id = _int_param(params, "place_id", default=DEFAULT_PLACE_ID)
        qg = _first(params, "quality_grade")
        quality_grade = None if (qg is not None and qg.lower() == "any") else (qg or "research")

        kwargs: dict[str, Any] = {
            "radius_km": radius,
            "per_page": per_page if per_page is not None else 50,
            "max_pages": max_pages if max_pages is not None else 10,
            "quality_grade": quality_grade,
            "place_id": place_id,
        }

        # * Import inside handler so importing this module never circular-imports package __init__.
        from inaturalist_usa_fish import fetch_fish_near

        records = fetch_fish_near(lat, lon, **kwargs)
        payload = {
            "count": len(records),
            "observations": [asdict(r) for r in records],
        }
        return _response(200, payload)

    except ValueError as exc:
        return _response(400, {"error": "bad_request", "message": str(exc)})
    except Exception:
        # * Ensures CloudWatch receives a stack trace for unexpected failures.
        logger.exception("Unhandled error in lambda_handler")
        return _response(
            500,
            {
                "error": "internal_error",
                "message": "An unexpected error occurred.",
                "request_id": getattr(context, "aws_request_id", None),
            },
        )
