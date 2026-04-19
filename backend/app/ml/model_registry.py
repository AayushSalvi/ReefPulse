"""Logical model names mapped to configured SageMaker endpoints."""

from __future__ import annotations

from app.core.config import settings

SPECIES_FISH_RANKED = "species_fish_ranked"


def endpoint_for(model_key: str) -> str:
    """Resolves a logical model key to an endpoint name from settings."""
    if model_key == SPECIES_FISH_RANKED:
        return settings.sagemaker_endpoint_species
    raise KeyError(f"Unknown model key: {model_key!r}")
