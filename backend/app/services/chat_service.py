"""Gemini-backed assistant (Google AI Studio / Gemini API)."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import Settings

_BACKEND_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"

DEFAULT_SYSTEM = (
    "You are ReefPulse Assistant, helping people with ocean recreation, California coastal "
    "conditions at a high level, and marine life identification tips. Be concise and practical. "
    "Do not give medical or legal advice or replace official NOAA, lifeguard, or beach warnings. "
    "If you are unsure, say so."
)


def _strip_gemini_secret(value: str | None) -> str:
    if value is None:
        return ""
    s = value.strip()
    if not s:
        return ""
    if s.startswith("\ufeff"):
        s = s[1:].strip()
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        s = s[1:-1].strip()
    return s


def _read_gemini_api_key_from_backend_env_file() -> str | None:
    """Reads `GEMINI_API_KEY` from `backend/.env` only (no merge with OS)."""
    if not _BACKEND_ENV_PATH.is_file():
        return None
    try:
        lines = _BACKEND_ENV_PATH.read_text(encoding="utf-8").splitlines()
    except OSError:
        return None
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if not line.upper().startswith("GEMINI_API_KEY="):
            continue
        value = line.split("=", 1)[1].strip()
        if not value:
            return None
        return value
    return None


def resolve_gemini_api_key() -> str:
    """* Prefers `backend/.env` over `GEMINI_API_KEY` in the process environment.

    Pydantic otherwise lets OS env override the file, so an old exported key in a shell can
    mask a rotated key in `backend/.env`.
    """
    file_raw = _read_gemini_api_key_from_backend_env_file()
    if file_raw:
        return _strip_gemini_secret(file_raw)
    env_raw = os.environ.get("GEMINI_API_KEY")
    if env_raw and env_raw.strip():
        return _strip_gemini_secret(env_raw)
    cfg = Settings()
    return _strip_gemini_secret(cfg.gemini_api_key or "")


def _extract_reply_text(data: dict[str, Any]) -> str:
    cands = data.get("candidates") or []
    if not cands:
        fb = data.get("promptFeedback")
        if fb:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gemini prompt blocked or empty: {fb}",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini returned no candidates.",
        )
    parts = (cands[0].get("content") or {}).get("parts") or []
    chunks = [str(p.get("text", "")) for p in parts if isinstance(p, dict)]
    out = "".join(chunks).strip()
    if not out:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini returned an empty reply.",
        )
    return out


def gemini_reply(user_message: str) -> tuple[str, str]:
    """Calls Gemini `generateContent`; returns (reply_text, model_id)."""
    # * New `Settings()` each call so `GEMINI_MODEL` and other settings pick up `.env` edits.
    cfg = Settings()
    key = resolve_gemini_api_key()
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini is not configured. Set GEMINI_API_KEY in the backend environment (e.g. backend/.env).",
        )
    model = (cfg.gemini_model or "gemini-2.5-flash").strip()
    if model.startswith("models/"):
        model = model.removeprefix("models/")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": DEFAULT_SYSTEM}]},
        "contents": [{"role": "user", "parts": [{"text": user_message}]}],
        "generationConfig": {"maxOutputTokens": 1024, "temperature": 0.65},
    }
    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, params={"key": key}, json=payload)
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach Gemini API: {exc}",
        ) from exc

    if resp.status_code != 200:
        try:
            err_body = resp.json()
            msg = err_body.get("error", {}).get("message", resp.text)
        except Exception:
            msg = resp.text or resp.reason_phrase
        extra = ""
        if resp.status_code in (400, 403) and (
            "API key" in msg or "EXPIRED" in msg.upper() or "invalid" in msg.lower()
        ):
            extra = (
                " If you rotated the key, ensure it is saved in backend/.env and remove GEMINI_API_KEY "
                "from your shell or Windows user environment so an old value cannot override the file."
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"Gemini error ({resp.status_code}): {msg}{extra} "
                f"(ReefPulse requested model: {model!r} — if this differs from Google’s message, "
                "restart uvicorn and clear any shell/system GEMINI_MODEL override.)"
            ),
        )

    try:
        data = resp.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini returned non-JSON.",
        ) from exc

    return _extract_reply_text(data), model
