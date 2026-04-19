from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class FusionBriefingRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    target_date: date | None = None
    top_k: int = Field(default=5, ge=1, le=100)
    location: str | None = None


class FusionBriefingResponse(BaseModel):
    history: dict[str, Any]
    forecast: dict[str, Any]
    selected_forecast: dict[str, Any]
    anomaly: dict[str, Any]
    species: dict[str, Any]
    headline: str
