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
    sagemaker_endpoint_species: str = "fish-sd-top100"
    sagemaker_endpoint_anomaly: str = "anomaly-endpoint"
    sns_topic_arn: str | None = None
    model_b_threshold: float = 0.15
    model_b_high_threshold: float = 0.25
    model_b_local_artifact: Path = Path("backend/training/model_b/artifacts/model_b_stats.json")
    database_url: str = Field(
        default="sqlite:///./reefpulse.db",
        description="SQLAlchemy URL, e.g. sqlite:///./reefpulse.db or postgresql+psycopg://user:pass@host:5432/reefpulse",
    )
    create_tables_on_startup: bool = Field(
        default=True,
        description="If true, run Base.metadata.create_all on startup (dev). Prefer migrations in production.",
    )
    jwt_secret: str = Field(
        default="change-me-in-production-use-long-random-secret",
        description="HS256 secret for Bearer tokens (sub = user UUID).",
    )
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = Field(
        default=60 * 24 * 7,
        ge=5,
        le=60 * 24 * 30,
        description="Access token lifetime in minutes.",
    )
    allow_registration: bool = Field(
        default=True,
        description="If false, POST /auth/register returns 403.",
    )
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
        description="Comma-separated origins for CORS (dev SPA).",
    )
    community_upload_max_bytes: int = Field(
        default=8_388_608,
        description="Max declared size for a single community image upload (presign).",
    )
    community_upload_allowed_content_types: str = Field(
        default="image/jpeg,image/png,image/webp",
        description="Comma-separated MIME types allowed for community image presign.",
    )
    community_s3_key_prefix: str = Field(
        default="community/uploads",
        description="S3 key prefix for presigned uploads; keys must be {prefix}/{user_id}/...",
    )
    community_presign_ttl_seconds: int = Field(default=3600, ge=60, le=86400)

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
