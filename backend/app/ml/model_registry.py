from __future__ import annotations

from dataclasses import dataclass
import json
from math import log
from pathlib import Path
from typing import Protocol

from app.core.config import settings
from app.schemas.anomaly import DEFAULT_MODEL_B_FEATURES


@dataclass
class ReconstructionResult:
    reconstruction: list[float]
    latent_mean: list[float]
    latent_logvar: list[float]
    model_source: str


class SupportsReconstruction(Protocol):
    def reconstruct(self, state_vector: list[float]) -> ReconstructionResult:
        ...


class HeuristicAnomalyModel:
    def __init__(
        self,
        *,
        feature_means: list[float] | None = None,
        feature_stds: list[float] | None = None,
        latent_dim: int = 4,
        shrink_factor: float = 0.15,
        source: str = "heuristic-stub",
    ) -> None:
        self.feature_means = feature_means or [0.0] * len(DEFAULT_MODEL_B_FEATURES)
        self.feature_stds = feature_stds or [1.0] * len(self.feature_means)
        self.latent_dim = max(1, latent_dim)
        self.shrink_factor = shrink_factor
        self.source = source

    def reconstruct(self, state_vector: list[float]) -> ReconstructionResult:
        means = self._match_length(self.feature_means, len(state_vector), fill=0.0)
        stds = self._match_length(self.feature_stds, len(state_vector), fill=1.0)

        reconstruction: list[float] = []
        normalized_values: list[float] = []
        for value, mean, std in zip(state_vector, means, stds):
            safe_std = std if abs(std) > 1e-6 else 1.0
            normalized = (value - mean) / safe_std
            normalized_values.append(normalized)
            reconstruction.append(mean + ((value - mean) * self.shrink_factor))

        latent_mean = self._compress(normalized_values)
        latent_logvar = [log(abs(value) + 1.0) for value in latent_mean]
        return ReconstructionResult(
            reconstruction=reconstruction,
            latent_mean=latent_mean,
            latent_logvar=latent_logvar,
            model_source=self.source,
        )

    def _compress(self, values: list[float]) -> list[float]:
        if not values:
            return [0.0] * self.latent_dim

        chunk_size = max(1, len(values) // self.latent_dim)
        compressed: list[float] = []
        for start in range(0, len(values), chunk_size):
            chunk = values[start : start + chunk_size]
            compressed.append(sum(chunk) / len(chunk))
            if len(compressed) == self.latent_dim:
                break

        while len(compressed) < self.latent_dim:
            compressed.append(0.0)
        return compressed

    @staticmethod
    def _match_length(values: list[float], target_length: int, *, fill: float) -> list[float]:
        if len(values) >= target_length:
            return values[:target_length]
        return values + [fill] * (target_length - len(values))


def _load_stats_artifact(artifact_path: Path) -> SupportsReconstruction | None:
    if not artifact_path.exists():
        return None

    payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    feature_means = [float(value) for value in payload.get("feature_means", [])]
    feature_stds = [float(value) for value in payload.get("feature_stds", [])]
    latent_dim = int(payload.get("latent_dim", 4))
    shrink_factor = float(payload.get("shrink_factor", 0.15))

    return HeuristicAnomalyModel(
        feature_means=feature_means or None,
        feature_stds=feature_stds or None,
        latent_dim=latent_dim,
        shrink_factor=shrink_factor,
        source=f"artifact:{artifact_path.name}",
    )


def load_model_b() -> SupportsReconstruction:
    artifact_model = _load_stats_artifact(settings.resolved_model_b_local_artifact)
    if artifact_model is not None:
        return artifact_model

    return HeuristicAnomalyModel()
