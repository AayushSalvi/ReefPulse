"""Species encounter ranking API schemas."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class SpeciesRankRequest(BaseModel):
    location: str = Field(..., description="Human-readable place name.")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    season: str | None = Field(default=None, description="Optional season label (e.g. spring).")
    state_vector: list[float] | None = Field(
        default=None,
        description="Optional ocean-state features; used as tie-break jitter in demo ranker.",
    )
    top_k: int = Field(default=10, ge=1, le=10, description="Number of ranked species to return (max 10).")
    observed_date: date | None = None
    image_count: int = Field(default=0, ge=0)
    temperature: float | None = Field(default=None, description="Surface temp in °C if known.")
    min_probability: float = Field(default=0.0, ge=0.0, le=1.0)
    rarity: str | None = Field(default=None, description="Optional filter hint; demo ranker ignores.")


class SpeciesPrediction(BaseModel):
    species: str
    encounter_probability: float = Field(..., ge=0.0, le=1.0)
    taxon_id: int = Field(default=0, description="iNaturalist-style taxon id placeholder in demo.")
    rarity: str
    safety: str
    label: str
    rarity_flag: bool = False
    safety_flag: str = Field(default="ok", description="ok | caution | avoid in demo.")


class SpeciesRankResponse(BaseModel):
    location: str
    model_source: str
    predictions: list[SpeciesPrediction]
    query: dict[str, object] = Field(default_factory=dict)
    model: dict[str, object] = Field(default_factory=dict)
    notes: list[str] = Field(default_factory=list)
