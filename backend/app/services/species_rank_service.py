"""Species encounter ranking: SageMaker Model D first, deterministic demo fallback."""

from __future__ import annotations

import hashlib
import logging
import math
from datetime import date
from typing import Any

from fastapi import HTTPException

from app.ml import model_registry
from app.schemas.species import SpeciesPrediction, SpeciesRankRequest, SpeciesRankResponse
from app.services import species_service

logger = logging.getLogger(__name__)

# Slugs aligned with frontend `mockData` beach ids → lat/lon + display name
LOCATION_PRESETS: dict[str, dict[str, float | str]] = {
    "la-jolla-shores": {"name": "La Jolla Shores", "lat": 32.858, "lng": -117.256},
    "carmel-river-beach": {"name": "Carmel River State Beach", "lat": 36.54, "lng": -121.908},
    "crystal-cove": {"name": "Crystal Cove State Beach", "lat": 33.577, "lng": -117.847},
    "leo-carrillo": {"name": "Leo Carrillo State Park", "lat": 34.104, "lng": -118.933},
    "refugio-beach": {"name": "Refugio State Beach", "lat": 34.47, "lng": -120.071},
}

_SPECIES_CATALOG: tuple[dict[str, object], ...] = (
    {"species": "Garibaldi", "taxon_id": 47226, "label": "Kelp forest icon"},
    {"species": "Leopard shark", "taxon_id": 51900, "label": "Sandy flats"},
    {"species": "Bat ray", "taxon_id": 47797, "label": "Shuffle entry zones"},
    {"species": "California sea lion", "taxon_id": 41678, "label": "Keep distance"},
    {"species": "Harbor seal", "taxon_id": 41677, "label": "Wide berth on rocks"},
    {"species": "Sheephead", "taxon_id": 96750, "label": "Rocky reef"},
    {"species": "Moray eel", "taxon_id": 49512, "label": "Crevice hunter"},
    {"species": "Green sea turtle", "taxon_id": 64714, "label": "Protected — no touch"},
    {"species": "Sea otter", "taxon_id": 41700, "label": "Monterey kelp"},
    {"species": "Kelp bass", "taxon_id": 47527, "label": "Near structure"},
    {"species": "Two-spot octopus", "taxon_id": 53843, "label": "Tide pools"},
    {"species": "Dolphin (common)", "taxon_id": 41508, "label": "Open water"},
    {"species": "Giant kelp", "taxon_id": 48745, "label": "Canopy habitat"},
    {"species": "Horn shark", "taxon_id": 51902, "label": "Night prowler"},
)


def _digest_floats(*parts: str | float) -> float:
    h = hashlib.sha256("".join(str(p) for p in parts).encode()).digest()
    return int.from_bytes(h[:8], "big") / 2**64


def _state_jitter(state_vector: list[float] | None) -> float:
    if not state_vector:
        return 0.0
    return (sum(state_vector[:16]) % 17) / 1000.0


def _observation_date_str(req: SpeciesRankRequest) -> str | None:
    if req.observed_date is None:
        return None
    return req.observed_date.isoformat()


def _sagemaker_dict_to_response(req: SpeciesRankRequest, raw: dict[str, Any]) -> SpeciesRankResponse:
    """Maps SageMaker JSON (Model D contract) into `SpeciesRankResponse`."""
    preds_raw = raw.get("predictions")
    if not isinstance(preds_raw, list) or not preds_raw:
        raise ValueError("SageMaker response missing predictions")
    top_k = min(10, max(1, req.top_k))
    predictions: list[SpeciesPrediction] = []
    for p in preds_raw[:top_k]:
        if not isinstance(p, dict):
            continue
        species = p.get("species") or p.get("name") or p.get("scientific_name") or "Unknown"
        raw_prob = p.get("encounter_probability", p.get("probability", p.get("score")))
        if raw_prob is None:
            continue
        prob = max(0.0, min(1.0, float(raw_prob)))
        predictions.append(
            SpeciesPrediction(
                species=str(species),
                encounter_probability=round(prob, 4),
                taxon_id=int(p.get("taxon_id", 0) or 0),
                rarity=str(p.get("rarity", "common")),
                safety=str(p.get("safety", "ok")),
                label=str(p.get("label", "")),
                rarity_flag=bool(p.get("rarity_flag", False)),
                safety_flag=str(p.get("safety_flag", "ok")),
            )
        )
    if not predictions:
        raise ValueError("SageMaker predictions empty after mapping")
    model_meta = raw.get("model") if isinstance(raw.get("model"), dict) else {}
    endpoint_name = model_registry.endpoint_for(model_registry.SPECIES_FISH_RANKED)
    trainer = model_meta.get("trainer_backend") or model_meta.get("model_source")
    model_source = str(trainer) if trainer else f"sagemaker:{endpoint_name}"
    q = raw.get("query") if isinstance(raw.get("query"), dict) else {}
    raw_notes = raw.get("notes")
    note_lines: list[str] = []
    if isinstance(raw_notes, list):
        note_lines.extend(str(n) for n in raw_notes)
    note_lines.append(
        f"Species ranked via SageMaker endpoint `{endpoint_name}` ({model_registry.SPECIES_FISH_RANKED})."
    )
    return SpeciesRankResponse(
        location=req.location,
        model_source=model_source,
        predictions=predictions,
        query={
            "latitude": req.latitude,
            "longitude": req.longitude,
            **q,
        },
        model=dict(model_meta),
        notes=note_lines,
    )


def rank_species_with_sagemaker_fallback(req: SpeciesRankRequest) -> SpeciesRankResponse:
    """* Tries SageMaker (same payload as GET Model D); falls back to deterministic demo."""
    top_k = min(10, max(1, req.top_k))
    try:
        raw = species_service.ranked_species_near(
            latitude=req.latitude,
            longitude=req.longitude,
            observation_date=_observation_date_str(req),
            top_k=top_k,
        )
        return _sagemaker_dict_to_response(req, raw)
    except (HTTPException, ValueError, TypeError, KeyError) as exc:
        if isinstance(exc, HTTPException):
            logger.warning("SageMaker species rank unavailable (%s), using demo ranker", exc.detail)
        else:
            logger.warning("SageMaker species rank mapping failed (%s), using demo ranker", exc)
        return rank_species(req)
    except Exception as exc:  # noqa: BLE001 — intentional broad fallback for boto/network
        logger.warning("SageMaker species rank failed (%s), using demo ranker", exc)
        return rank_species(req)


def rank_species(req: SpeciesRankRequest) -> SpeciesRankResponse:
    """Score catalog species from lat/lon + optional state vector; return top_k sorted."""
    top_k = min(10, max(1, req.top_k))
    lat, lon = req.latitude, req.longitude
    jitter = _state_jitter(req.state_vector)

    scored: list[tuple[float, dict[str, object]]] = []
    for row in _SPECIES_CATALOG:
        name = str(row["species"])
        base = _digest_floats(req.location, lat, lon, name) * 0.55 + 0.2
        seasonal = 0.08 * math.sin((lat + lon) * 0.01 + len(name) * 0.07)
        p = min(0.97, max(req.min_probability + 0.02, base + seasonal + jitter))
        scored.append((p, row))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:top_k]

    predictions: list[SpeciesPrediction] = []
    for prob, row in top:
        p = float(prob)
        rarity = "rare" if p >= 0.78 else "uncommon" if p >= 0.55 else "common"
        safety_flag = "caution" if p < 0.35 else "ok"
        safety = {
            "flag": safety_flag,
            "message": "Limited confidence for close encounter." if safety_flag == "caution" else "Normal viewing conditions.",
        }
        predictions.append(
            SpeciesPrediction(
                species=str(row["species"]),
                encounter_probability=round(p, 4),
                taxon_id=str(row["taxon_id"]),
                rarity=rarity,
                safety=safety,
                label=str(row["label"]),
                rarity_flag=rarity == "rare",
                safety_flag="avoid" if safety_flag != "ok" else "ok",
            )
        )

    notes = [
        "Deterministic demo ranker (no ML). Probabilities are reproducible for a given lat/lon + location string.",
    ]
    if req.observed_date:
        notes.append(f"observed_date={req.observed_date} (metadata only in demo).")

    return SpeciesRankResponse(
        location=req.location,
        model_source="deterministic-demo-v1",
        predictions=predictions,
        query={
            "top_k": top_k,
            "latitude": lat,
            "longitude": lon,
            "season": req.season,
            "temperature_c": req.temperature,
        },
        model={"catalog_size": len(_SPECIES_CATALOG)},
        notes=notes,
    )


def rank_for_slug(location_slug: str, top_k: int = 10) -> SpeciesRankResponse | None:
    preset = LOCATION_PRESETS.get(location_slug)
    if not preset:
        return None
    today = date.today()
    req = SpeciesRankRequest(
        location=str(preset["name"]),
        latitude=float(preset["lat"]),
        longitude=float(preset["lng"]),
        top_k=top_k,
        observed_date=today,
    )
    return rank_species(req)
