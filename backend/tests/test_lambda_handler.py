"""Tests for AWS Lambda handler responses."""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from inaturalist_usa_fish.lambda_handler import lambda_handler
from inaturalist_usa_fish.models import FishObservation


class _FakeContext:
    aws_request_id = "test-req-id"


def _body(resp: dict) -> dict:
    assert "body" in resp
    return json.loads(resp["body"])


def test_direct_invoke_success() -> None:
    fake = [
        FishObservation(
            observation_id=1,
            latitude=32.0,
            longitude=-117.0,
            taxon_id=99,
            image_urls=("https://example.com/a.jpg",),
            taxon_name="Test fish",
            posted_at="2026-01-01T12:00:00+00:00",
        )
    ]
    with patch("inaturalist_usa_fish.fetch_fish_near", return_value=fake):
        resp = lambda_handler({"lat": "32", "lon": "-117", "radius_km": "10"}, _FakeContext())

    assert resp["statusCode"] == 200
    assert resp["headers"]["Content-Type"].startswith("application/json")
    data = _body(resp)
    assert data["count"] == 1
    assert data["observations"][0]["taxon_id"] == 99
    assert data["observations"][0]["image_urls"] == ["https://example.com/a.jpg"]
    assert data["observations"][0]["posted_at"] == "2026-01-01T12:00:00+00:00"


def test_api_gateway_v2_query_string() -> None:
    with patch("inaturalist_usa_fish.fetch_fish_near", return_value=[]):
        resp = lambda_handler(
            {
                "version": "2.0",
                "routeKey": "GET /fish",
                "queryStringParameters": {"lat": "1", "lon": "2"},
            },
            _FakeContext(),
        )
    assert resp["statusCode"] == 200
    assert _body(resp)["count"] == 0


def test_missing_lat_returns_400() -> None:
    resp = lambda_handler({"lon": "-117"}, _FakeContext())
    assert resp["statusCode"] == 400
    assert _body(resp)["error"] == "missing_parameters"


def test_invalid_lat_returns_400() -> None:
    resp = lambda_handler({"lat": "x", "lon": "-117"}, _FakeContext())
    assert resp["statusCode"] == 400
    assert _body(resp)["error"] == "bad_request"


@pytest.mark.parametrize("method_key", ["httpMethod", "nested"])
def test_options_returns_204(method_key: str) -> None:
    if method_key == "httpMethod":
        event = {"httpMethod": "OPTIONS"}
    else:
        event = {"requestContext": {"http": {"method": "OPTIONS"}}}
    resp = lambda_handler(event, _FakeContext())
    assert resp["statusCode"] == 204
    assert resp["body"] == ""


def test_post_json_body() -> None:
    with patch("inaturalist_usa_fish.fetch_fish_near", return_value=[]):
        resp = lambda_handler(
            {"body": json.dumps({"latitude": 10.0, "longitude": -20.0})},
            _FakeContext(),
        )
    assert resp["statusCode"] == 200


def test_unhandled_error_returns_500() -> None:
    with patch("inaturalist_usa_fish.fetch_fish_near", side_effect=RuntimeError("boom")):
        resp = lambda_handler({"lat": "1", "lon": "2"}, _FakeContext())
    assert resp["statusCode"] == 500
    data = _body(resp)
    assert data["error"] == "internal_error"
    assert data["request_id"] == "test-req-id"
