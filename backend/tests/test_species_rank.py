from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@patch("app.services.species_rank_service.species_service.ranked_species_near")
def test_species_rank_post_returns_top_predictions(mock_rank: MagicMock) -> None:
    """When SageMaker fails, POST /rank falls back to the deterministic demo."""
    mock_rank.side_effect = HTTPException(status_code=503, detail="unavailable")
    r = client.post(
        "/api/v1/species/rank",
        json={
            "location": "La Jolla Shores",
            "latitude": 32.858,
            "longitude": -117.256,
            "top_k": 10,
            "observed_date": "2026-04-19",
            "state_vector": [0.1] * 8,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["model_source"] == "deterministic-demo-v1"
    assert len(data["predictions"]) == 10
    first = data["predictions"][0]
    assert "species" in first
    assert isinstance(first["taxon_id"], str)
    assert isinstance(first["safety"], dict)
    assert 0 <= first["encounter_probability"] <= 1
    probs = [p["encounter_probability"] for p in data["predictions"]]
    assert probs == sorted(probs, reverse=True)


@patch("app.services.species_rank_service.species_service.ranked_species_near")
def test_species_rank_post_maps_sagemaker_payload(mock_rank: MagicMock) -> None:
    mock_rank.return_value = {
        "query": {"latitude": 32.858, "longitude": -117.256},
        "model": {"trainer_backend": "lightgbm-test"},
        "predictions": [
            {"species": "Garibaldi", "encounter_probability": 0.9, "taxon_id": 47226},
            {"species": "Kelp bass", "encounter_probability": 0.5},
        ],
    }
    r = client.post(
        "/api/v1/species/rank",
        json={
            "location": "La Jolla Shores",
            "latitude": 32.858,
            "longitude": -117.256,
            "top_k": 10,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["model_source"] == "lightgbm-test"
    assert len(data["predictions"]) == 2
    assert data["predictions"][0]["species"] == "Garibaldi"
    assert data["predictions"][0]["encounter_probability"] == 0.9
    mock_rank.assert_called_once()


def test_species_get_by_slug() -> None:
    r = client.get("/api/v1/species/la-jolla-shores?top_k=5")
    assert r.status_code == 200
    assert len(r.json()["predictions"]) == 5


def test_species_status() -> None:
    r = client.get("/api/v1/species/status")
    assert r.status_code == 200
    body = r.json()
    assert body.get("ready") is True
    assert body.get("species_rank_model") == "sagemaker-with-demo-fallback"
