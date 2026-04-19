"""Species ranking + encounter predictions (Model B anomaly–informed)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SpeciesRankItem(BaseModel):
    name: str
    rank: int = Field(..., ge=1)
    score: float = Field(..., description="Relative rank score (higher = more salient this week).")
    encounter_pct: int = Field(..., ge=0, le=100, description="Illustrative encounter likelihood for UI.")


class SpeciesPredictionsResponse(BaseModel):
    location_slug: str
    items: list[SpeciesRankItem]
    anomaly_severity: str
    anomaly_score: float
    model_source: str


class SpeciesRankRequest(BaseModel):
    location_slug: str
    species_order: list[str] = Field(
        ...,
        min_length=1,
        description="Preferred species order (e.g. drag-and-drop); server assigns ranks 1..n.",
    )


class SpeciesRankResponse(BaseModel):
    location_slug: str
    items: list[SpeciesRankItem]
    accepted: bool = True


class SpeciesStatusResponse(BaseModel):
    species_api: str = "ok"
    anomaly_ready: bool
    anomaly_model_source: str
