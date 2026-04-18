"""Tests for iNaturalist HTTP client (mocked)."""

from __future__ import annotations

import httpx

from inaturalist_usa_fish.client import iter_observation_pages
from inaturalist_usa_fish import fetch_fish_near


def test_iter_observation_pages_query_and_pagination() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        params = httpx.URL(request.url).params
        page = params.get("page", "1")
        if page == "1":
            return httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "id": 100,
                            "latitude": 24.0,
                            "longitude": -81.0,
                            "taxon": {"id": 51402, "name": "Megalops atlanticus"},
                            "photos": [{"url": "https://example.com/p.jpg"}],
                        }
                    ]
                },
            )
        return httpx.Response(200, json={"results": []})

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as client:
        pages = list(
            iter_observation_pages(
                swlat=23.0,
                swlng=-82.0,
                nelat=25.0,
                nelng=-80.0,
                place_id=14,
                taxon_ids=(47178, 196614),
                quality_grade="research",
                per_page=50,
                max_pages=5,
                client=client,
            )
        )

    assert len(pages) == 2
    assert len(pages[0]) == 1
    assert pages[1] == []

    assert len(requests) == 2
    params = httpx.URL(requests[0].url).params
    assert params["taxon_id"] == "47178,196614"
    assert params["place_id"] == "14"
    assert params["photos"] == "true"
    assert params["geo"] == "true"
    assert params["quality_grade"] == "research"
    assert float(params["swlat"]) == 23.0
    assert float(params["nelat"]) == 25.0


def test_iter_observation_pages_respects_max_pages() -> None:
    call_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(
            200,
            json={
                "results": [
                    {
                        "id": call_count,
                        "latitude": 1.0,
                        "longitude": 2.0,
                        "taxon": {"id": 3},
                        "photos": [],
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as client:
        pages = list(
            iter_observation_pages(
                swlat=0.0,
                swlng=0.0,
                nelat=1.0,
                nelng=1.0,
                max_pages=1,
                client=client,
            )
        )

    assert len(pages) == 1
    assert call_count == 1


def test_fetch_fish_near_end_to_end_mocked() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "results": [
                    {
                        "id": 7,
                        "geojson": {"type": "Point", "coordinates": [-81.5, 24.7]},
                        "taxon": {"id": 42, "name": "Testidae testus"},
                        "photos": [{"url": "https://example.com/x.jpg"}],
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as client:
        rows = fetch_fish_near(24.7, -81.5, radius_km=10.0, max_pages=1, client=client)

    assert len(rows) == 1
    assert rows[0].observation_id == 7
    assert rows[0].taxon_id == 42
    assert rows[0].latitude == 24.7
    assert rows[0].longitude == -81.5
    assert rows[0].image_urls == ("https://example.com/x.jpg",)
