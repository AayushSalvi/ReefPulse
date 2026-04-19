from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ReefPulse API"
    environment: str = "dev"
    api_prefix: str = "/api/v1"
    aws_region: str = "us-west-2"
    s3_bucket: str = "reefpulse-dev"
    model_a_artifact_path: str | None = Field(
        default=None,
        description="Path to trained Model A checkpoint (.pt) with mean/std for local inference.",
    )
    model_a_mc_samples: int = 30
    sagemaker_endpoint_forecast: str = "forecast-endpoint"
    sagemaker_endpoint_hab: str = "hab-endpoint"
    sagemaker_endpoint_species: str = "species-endpoint"
    sagemaker_endpoint_anomaly: str = "anomaly-endpoint"
    sns_topic_arn: str | None = None
    model_b_threshold: float = 0.15
    model_b_high_threshold: float = 0.25
    model_b_local_artifact: Path = Path("backend/training/model_b/artifacts/model_b_stats.json")

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[3]

    @property
    def resolved_model_b_local_artifact(self) -> Path:
        if self.model_b_local_artifact.is_absolute():
            return self.model_b_local_artifact
        return self.project_root / self.model_b_local_artifact


settings = Settings()
