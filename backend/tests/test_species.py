import io
import json
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.clients.aws_clients import sagemaker_runtime_client
from app.main import app

client = TestClient(app)


@patch("app.services.species_service.sagemaker_runtime_client")
def test_species_route_merges_location_and_model_json(mock_runtime_fn: MagicMock) -> None:
    sagemaker_runtime_client.cache_clear()
    mock_client = MagicMock()
    mock_runtime_fn.return_value = mock_client
    payload = {
        "query": {"latitude": 32.7, "longitude": -117.16, "date": "2026-07-15", "season": "summer"},
        "model": {"trainer_backend": "lightgbm", "num_classes": 100, "temperature": 1.0},
        "predictions": [],
    }
    mock_client.invoke_endpoint.return_value = {
        "Body": io.BytesIO(json.dumps(payload).encode("utf-8")),
    }

    response = client.get(
        "/api/v1/species/san-diego-bay",
        params={"lat": 32.7, "lon": -117.16, "date": "2026-07-15", "top_k": 5},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["location_slug"] == "san-diego-bay"
    assert body["predictions"] == []
    mock_client.invoke_endpoint.assert_called_once()
    call_kw = mock_client.invoke_endpoint.call_args.kwargs
    assert call_kw["EndpointName"] == "fish-sd-top100"
    sent = json.loads(call_kw["Body"].decode("utf-8"))
    assert sent["latitude"] == 32.7
    assert sent["longitude"] == -117.16
    assert sent["date"] == "2026-07-15"
    assert sent["top_k"] == 5


@patch("app.services.species_service.sagemaker_runtime_client")
def test_species_route_maps_sagemaker_errors(mock_runtime_fn: MagicMock) -> None:
    sagemaker_runtime_client.cache_clear()
    from botocore.exceptions import ClientError

    mock_client = MagicMock()
    mock_runtime_fn.return_value = mock_client
    mock_client.invoke_endpoint.side_effect = ClientError(
        {"Error": {"Code": "ValidationException", "Message": "x"}},
        "InvokeEndpoint",
    )

    response = client.get(
        "/api/v1/species/test",
        params={"lat": 1.0, "lon": 2.0},
    )
    assert response.status_code == 502
