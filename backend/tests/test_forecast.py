from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_model_a_status_without_artifact() -> None:
    r = client.get("/api/v1/forecasts/model-a/status")
    assert r.status_code == 200
    data = r.json()
    assert data["loaded"] is False


def test_model_a_forecast_503_without_artifact() -> None:
    past = [[0.0] * 4] * 30
    r = client.post(
        "/api/v1/forecasts/model-a",
        json={"station_id": "test", "past_series": past},
    )
    assert r.status_code == 503


def test_model_a_forecast_422_bad_shape() -> None:
    r = client.post(
        "/api/v1/forecasts/model-a",
        json={"past_series": [[0.0] * 4] * 10},
    )
    assert r.status_code == 422
