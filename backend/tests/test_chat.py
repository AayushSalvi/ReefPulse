"""Chat / Gemini endpoint (configured vs not)."""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
PREFIX = "/api/v1"


def test_chat_query_without_gemini_key_returns_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "")
    r = client.post(f"{PREFIX}/chat/query", json={"message": "Hello"})
    assert r.status_code == 503
    assert "GEMINI_API_KEY" in r.json().get("detail", "")


def test_chat_query_with_mocked_gemini_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key-for-test")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")

    def handler(request: httpx.Request) -> httpx.Response:
        assert "generativelanguage.googleapis.com" in str(request.url)
        body = {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": "Hi — try La Jolla Shores on a calm morning."}],
                    }
                }
            ]
        }
        return httpx.Response(200, json=body)

    transport = httpx.MockTransport(handler)
    real_client = httpx.Client

    def fake_client(*_a, **_kw):
        return real_client(transport=transport, timeout=_kw.get("timeout", 60.0))

    monkeypatch.setattr(httpx, "Client", fake_client)

    r = client.post(f"{PREFIX}/chat/query", json={"message": "Where should I snorkel?"})
    assert r.status_code == 200
    data = r.json()
    assert "La Jolla" in data["reply"]
    assert data["model"] == "gemini-2.5-flash"


def test_chat_query_validation_empty_message_422() -> None:
    r = client.post(f"{PREFIX}/chat/query", json={"message": ""})
    assert r.status_code == 422
