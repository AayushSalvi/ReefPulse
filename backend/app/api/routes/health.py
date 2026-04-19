from __future__ import annotations

from fastapi import APIRouter

from app.core.config import Settings

router = APIRouter(tags=["health"])


@router.get("/health")
def healthcheck() -> dict[str, str | bool]:
    """* Includes Gemini config snapshot so devs can confirm which backend instance is bound."""
    cfg = Settings()
    return {
        "status": "healthy",
        "service": "reefpulse-backend",
        "gemini_model": cfg.gemini_model,
        "gemini_api_key_set": bool((cfg.gemini_api_key or "").strip()),
    }
