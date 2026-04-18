from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ReefPulse API"
    environment: str = "dev"
    api_prefix: str = "/api/v1"
    aws_region: str = "us-west-2"
    s3_bucket: str = "reefpulse-dev"
    sagemaker_endpoint_forecast: str = "forecast-endpoint"
    sagemaker_endpoint_hab: str = "hab-endpoint"
    sagemaker_endpoint_species: str = "species-endpoint"
    sns_topic_arn: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
