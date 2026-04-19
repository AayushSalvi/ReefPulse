from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_species_rank_post_returns_top_predictions() -> None:
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


def test_species_get_by_slug() -> None:
    r = client.get("/api/v1/species/la-jolla-shores?top_k=5")
    assert r.status_code == 200
    assert len(r.json()["predictions"]) == 5


def test_species_status() -> None:
    r = client.get("/api/v1/species/status")
    assert r.status_code == 200
    assert r.json().get("ready") is True
