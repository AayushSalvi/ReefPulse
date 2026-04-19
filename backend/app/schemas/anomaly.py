from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


DEFAULT_MODEL_B_FEATURES = [
    "temperature_10m",
    "temperature_50m",
    "temperature_100m",
    "temperature_200m",
    "salinity_10m",
    "salinity_50m",
    "salinity_100m",
    "salinity_200m",
    "oxygen_10m",
    "oxygen_50m",
    "oxygen_100m",
    "oxygen_200m",
    "chlorophyll_10m",
    "chlorophyll_50m",
    "chlorophyll_100m",
    "chlorophyll_200m",
]


class AnomalyRequest(BaseModel):
    state_vector: list[float] | None = Field(default=None, min_length=1)
    feature_names: list[str] | None = None
    feature_map: dict[str, float] | None = None
    location: str | None = None
    observed_at: datetime | None = None

    @model_validator(mode="after")
    def validate_payload(self) -> "AnomalyRequest":
        if self.state_vector is None and self.feature_map is None:
            raise ValueError("Provide either state_vector or feature_map.")

        if self.state_vector is not None and self.feature_map is not None:
            raise ValueError("Provide state_vector or feature_map, not both.")

        if self.state_vector is not None and self.feature_names is not None:
            if len(self.state_vector) != len(self.feature_names):
                raise ValueError("feature_names must match the length of state_vector.")

        return self

    def to_feature_vector(self) -> tuple[list[str], list[float]]:
        if self.feature_map is not None:
            feature_names = list(self.feature_map.keys())
            state_vector = [float(value) for value in self.feature_map.values()]
            return feature_names, state_vector

        assert self.state_vector is not None
        if self.feature_names is not None:
            return self.feature_names, [float(value) for value in self.state_vector]

        if len(self.state_vector) == len(DEFAULT_MODEL_B_FEATURES):
            return DEFAULT_MODEL_B_FEATURES, [float(value) for value in self.state_vector]

        generated_names = [f"feature_{index + 1}" for index in range(len(self.state_vector))]
        return generated_names, [float(value) for value in self.state_vector]


class DrivingVariable(BaseModel):
    feature: str
    reconstruction_error: float
    absolute_error: float
    observed_value: float
    reconstructed_value: float


class AnomalyResponse(BaseModel):
    anomaly_score: float
    threshold: float
    high_threshold: float
    is_anomaly: bool
    severity: str
    model_source: str
    feature_names: list[str]
    reconstruction: list[float]
    latent_mean: list[float]
    latent_logvar: list[float]
    driving_variables: list[DrivingVariable]
