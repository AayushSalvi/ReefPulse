"""Auth: register, login, me, logout."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
PREFIX = "/api/v1"


def test_login_demo_and_me() -> None:
    r = client.post(
        f"{PREFIX}/auth/login",
        json={"email": "demo@reefpulse.dev", "password": "demo123"},
    )
    assert r.status_code == 200
    tok = r.json()["access_token"]
    assert r.json().get("token_type") == "bearer"
    assert r.json().get("expires_in", 0) > 0

    me = client.get(f"{PREFIX}/auth/me", headers={"Authorization": f"Bearer {tok}"})
    assert me.status_code == 200
    assert me.json()["handle"] == "You"
    assert me.json()["email"] == "demo@reefpulse.dev"


def test_me_without_token_401() -> None:
    r = client.get(f"{PREFIX}/auth/me")
    assert r.status_code == 401


def test_logout_noop_204() -> None:
    r = client.post(f"{PREFIX}/auth/logout")
    assert r.status_code == 204


def test_register_login_flow() -> None:
    import uuid

    email = f"tester_{uuid.uuid4().hex[:8]}@example.com"
    reg = client.post(
        f"{PREFIX}/auth/register",
        json={"email": email, "password": "longpassword1", "handle": "Tester"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]

    me = client.get(f"{PREFIX}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["handle"] == "Tester"


def test_register_password_over_72_bytes_returns_422() -> None:
    import uuid

    email = f"longpw_{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(
        f"{PREFIX}/auth/register",
        json={"email": email, "password": "x" * 73, "handle": "Tester"},
    )
    assert r.status_code == 422


def test_register_72_byte_ascii_password_ok() -> None:
    import uuid

    email = f"bc72_{uuid.uuid4().hex[:8]}@example.com"
    pw = "x" * 72
    reg = client.post(f"{PREFIX}/auth/register", json={"email": email, "password": pw, "handle": "x"})
    assert reg.status_code == 201


def test_register_unicode_password_over_72_utf8_bytes_returns_422() -> None:
    import uuid

    email = f"uni_{uuid.uuid4().hex[:8]}@example.com"
    pw = "\u3042" * 25  # 75 UTF-8 bytes, 25 characters
    r = client.post(f"{PREFIX}/auth/register", json={"email": email, "password": pw, "handle": "x"})
    assert r.status_code == 422
