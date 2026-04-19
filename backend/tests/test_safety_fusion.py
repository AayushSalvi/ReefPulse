from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_safety_fusion_returns_fused_payload() -> None:
    r = client.get("/api/v1/safety/test-beach")
    assert r.status_code == 200
    data = r.json()
    assert "safety_index" in data
    assert 0 <= data["safety_index"] <= 100
    assert data["beach_condition"] in {
        "excellent",
        "good",
        "moderate",
        "poor",
        "hazardous",
    }
    assert data["model_b"]["severity"] in {"normal", "elevated", "high"}
    assert isinstance(data["public_flags"], dict)
    assert data["display_location"] == "test-beach"
    assert data["model_a_used"] in (True, False)


def test_post_recreation_fusion_anomaly_only() -> None:
    r = client.post("/api/v1/safety/recreation", json={})
    assert r.status_code == 200
    data = r.json()
    assert "safety_index" in data
    assert data["model_a_used"] is False
    assert data["model_a_summary"] is None
