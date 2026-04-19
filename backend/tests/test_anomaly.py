from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_anomaly_score_route_returns_expected_shape() -> None:
    payload = {"state_vector": [1.5] * 16}
    response = client.post("/api/v1/anomaly/score", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["is_anomaly"] is True
    assert body["severity"] in {"elevated", "high"}
    assert len(body["feature_names"]) == 16
    assert len(body["reconstruction"]) == 16
    assert len(body["driving_variables"]) == 16
