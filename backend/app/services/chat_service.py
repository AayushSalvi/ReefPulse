"""Gemini-backed assistant (Google AI Studio / Gemini API)."""

from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import Settings

DEFAULT_SYSTEM = (
    "You are ReefPulse Assistant, helping people with ocean recreation, California coastal "
    "conditions at a high level, and marine life identification tips. Be concise and practical. "
    "Do not give medical or legal advice or replace official NOAA, lifeguard, or beach warnings. "
    "If you are unsure, say so."
)


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
    # * New `Settings()` each call so `backend/.env` edits apply without restarting uvicorn.
    cfg = Settings()
    key = (cfg.gemini_api_key or "").strip()
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
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"Gemini error ({resp.status_code}): {msg} "
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
