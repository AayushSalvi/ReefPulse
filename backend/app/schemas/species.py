"""Species encounter ranking API schemas."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field, model_validator


class SpeciesRankRequest(BaseModel):
    location: str | None = Field(default=None, description="Human-readable place name.")
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    season: str | None = Field(default=None, description="Optional season label (e.g. spring).")
    state_vector: list[float] | None = Field(
        default=None,
        description="Optional ocean-state features; used as tie-break jitter in demo ranker.",
    )
    top_k: int = Field(default=5, ge=1, le=100, description="Number of ranked species to return.")
    observed_date: date | None = None
    image_count: int = Field(default=0, ge=0)
    temperature: float | None = Field(default=None, description="Surface temp in °C if known.")
    min_probability: float = Field(default=0.0, ge=0.0, le=1.0)
    rarity: str | None = Field(default=None, description="Optional filter hint; demo ranker ignores.")

    @model_validator(mode="after")
    def validate_location_or_coords(self) -> "SpeciesRankRequest":
        has_lat = self.latitude is not None
        has_lng = self.longitude is not None
        if has_lat != has_lng:
            raise ValueError("latitude and longitude must be provided together.")
        if not (self.location or (has_lat and has_lng)):
            raise ValueError("Provide location or latitude+longitude.")
        return self


class SpeciesPrediction(BaseModel):
    species: str
    encounter_probability: float = Field(..., ge=0.0, le=1.0)
    taxon_id: str = Field(default="0", description="iNaturalist-style taxon id.")
    rarity: str
    safety: str | dict[str, object] = Field(
        default="ok",
        description="Safety indicator as string or structured payload.",
    )
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
