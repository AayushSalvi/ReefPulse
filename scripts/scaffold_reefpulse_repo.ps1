param(
    [string]$ProjectRoot = ".",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Ensure-Directory {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Ensure-File {
    param(
        [string]$Path,
        [string]$Content
    )

    $directory = Split-Path -Parent $Path
    if ($directory) {
        Ensure-Directory -Path $directory
    }

    if ((Test-Path -LiteralPath $Path) -and -not $Force) {
        Write-Host "skip  $Path"
        return
    }

    Set-Content -LiteralPath $Path -Value $Content -Encoding UTF8
    Write-Host "write $Path"
}

function Ensure-GitKeep {
    param([string]$DirectoryPath)

    Ensure-Directory -Path $DirectoryPath
    Ensure-File -Path (Join-Path $DirectoryPath ".gitkeep") -Content ""
}

$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
Write-Host "Scaffolding ReefPulse repo in $root"

$directories = @(
    "backend",
    "backend/app",
    "backend/app/api",
    "backend/app/api/routes",
    "backend/app/clients",
    "backend/app/core",
    "backend/app/ml",
    "backend/app/pipelines",
    "backend/app/repositories",
    "backend/app/schemas",
    "backend/app/services",
    "backend/app/workers",
    "backend/tests",
    "docs",
    "docs/architecture",
    "infra",
    "infra/aws",
    "infra/aws/lambda",
    "infra/aws/sagemaker",
    "infra/aws/eventbridge",
    "infra/aws/sns",
    "infra/aws/dynamodb",
    "infra/aws/timestream",
    "scripts"
)

foreach ($dir in $directories) {
    Ensure-Directory -Path (Join-Path $root $dir)
}

$rootReadme = @'
# ReefPulse

ReefPulse is an ocean intelligence web app for the California coast. Based on the project proposal, the backend needs to support:

- condition and hazard forecasting
- harmful algal bloom alerts
- marine life discovery predictions
- a Surf Safety Index fusion layer
- chatbot / question-answering hooks
- event-driven alerting and AWS deployment

This scaffold is organized so the backend can move quickly while still matching the proposal architecture.

## Suggested repo layout

- `backend/` FastAPI app, service layer, model adapters, ingestion jobs, tests
- `docs/` system notes, architecture, API decisions
- `infra/aws/` infrastructure as code and deployment assets
- `scripts/` local setup and project automation

## Quick start

1. Initialize git when you are ready:
   `git init`
2. Review or edit the scaffold:
   `powershell -ExecutionPolicy Bypass -File .\scripts\scaffold_reefpulse_repo.ps1`
3. Commit and push to GitHub after you add your real backend code.
'@

$gitignore = @'
# Python
__pycache__/
*.py[cod]
.pytest_cache/
.mypy_cache/
.ruff_cache/
.venv/
venv/

# Environment
.env
.env.*

# OS / editor
.DS_Store
Thumbs.db
.vscode/
.idea/

# Build / reports
dist/
build/
coverage/
htmlcov/

# Data / local artifacts
data/
tmp/
logs/
*.sqlite3
'@

$backendReadme = @'
# Backend

This backend scaffold follows the ReefPulse proposal:

- `api/routes/` public endpoints for forecasts, safety, species, alerts, and chat
- `services/` business logic and fusion logic
- `clients/` wrappers for NOAA, Scripps, iNaturalist, and AWS services
- `pipelines/` ingestion and feature-building jobs
- `ml/` model registry and inference routing
- `workers/` background processing and alert dispatch
- `repositories/` database / cache access

The starting assumption is Python + FastAPI because the proposal leans heavily on Python data and ML tooling.
'@

$pyproject = @'
[project]
name = "reefpulse-backend"
version = "0.1.0"
description = "Backend scaffold for the ReefPulse ocean intelligence platform"
requires-python = ">=3.11"
dependencies = [
  "boto3>=1.34.0",
  "fastapi>=0.115.0",
  "httpx>=0.27.0",
  "pydantic-settings>=2.4.0",
  "python-dotenv>=1.0.1",
  "uvicorn[standard]>=0.30.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.3.0",
  "pytest-asyncio>=0.23.0",
  "ruff>=0.6.0",
]

[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"
'@

$envExample = @'
APP_NAME=ReefPulse API
ENVIRONMENT=dev
API_PREFIX=/api/v1
AWS_REGION=us-west-2
S3_BUCKET=reefpulse-dev
SAGEMAKER_ENDPOINT_FORECAST=forecast-endpoint
SAGEMAKER_ENDPOINT_HAB=hab-endpoint
SAGEMAKER_ENDPOINT_SPECIES=species-endpoint
SNS_TOPIC_ARN=
'@

$mainPy = @'
from fastapi import FastAPI

from app.api.routes import alerts, chat, forecast, health, safety, species
from app.core.config import settings

app = FastAPI(title=settings.app_name)

app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(forecast.router, prefix=settings.api_prefix)
app.include_router(safety.router, prefix=settings.api_prefix)
app.include_router(species.router, prefix=settings.api_prefix)
app.include_router(alerts.router, prefix=settings.api_prefix)
app.include_router(chat.router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "status": "ok",
        "docs": "/docs",
    }
'@

$configPy = @'
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
'@

$healthPy = @'
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "healthy", "service": "reefpulse-backend"}
'@

$forecastPy = @'
from fastapi import APIRouter

router = APIRouter(prefix="/forecasts", tags=["forecasts"])


@router.get("")
def get_forecast() -> dict[str, object]:
    return {
        "message": "Forecast endpoint scaffolded.",
        "next_step": "Connect this route to the state forecaster service and NOAA/Scripps-backed features.",
    }
'@

$safetyPy = @'
from fastapi import APIRouter

router = APIRouter(prefix="/safety", tags=["safety"])


@router.get("/{location_slug}")
def get_safety_index(location_slug: str) -> dict[str, object]:
    return {
        "location": location_slug,
        "message": "Surf Safety Index endpoint scaffolded.",
        "next_step": "Fuse forecasts, anomalies, HAB risk, and live conditions here.",
    }
'@

$speciesPy = @'
from fastapi import APIRouter

router = APIRouter(prefix="/species", tags=["species"])


@router.get("/{location_slug}")
def get_species_predictions(location_slug: str) -> dict[str, object]:
    return {
        "location": location_slug,
        "message": "Marine life discovery endpoint scaffolded.",
        "next_step": "Connect iNaturalist + model inference for ranked encounter probabilities.",
    }
'@

$alertsPy = @'
from fastapi import APIRouter

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def list_alerts() -> dict[str, object]:
    return {
        "message": "Alerts endpoint scaffolded.",
        "next_step": "Wire SNS/EventBridge or your queue/worker flow here.",
    }
'@

$chatPy = @'
from fastapi import APIRouter

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/query")
def query_agent() -> dict[str, object]:
    return {
        "message": "Chat endpoint scaffolded.",
        "next_step": "Route user questions into your retrieval + model orchestration layer.",
    }
'@

$routesInit = @'
from app.api.routes import alerts, chat, forecast, health, safety, species

__all__ = [
    "alerts",
    "chat",
    "forecast",
    "health",
    "safety",
    "species",
]
'@

$placeholderModule = @'
"""Replace this placeholder with real implementation."""
'@

$schemaCommon = @'
from pydantic import BaseModel


class MessageResponse(BaseModel):
    message: str
    next_step: str | None = None
'@

$testHealth = @'
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_healthcheck() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
'@

$docsArchitecture = @'
# Architecture Notes

Backend responsibilities inferred from the ReefPulse proposal:

1. Ingest Scripps, NOAA, and iNaturalist data sources.
2. Expose forecast, safety, species, alert, and chat APIs.
3. Orchestrate model inference and the Surf Safety Index.
4. Support event-driven alerting and AWS deployment.
5. Keep the system modular enough for hackathon-speed iteration.
'@

$awsReadme = @'
# AWS Infra

Suggested ownership from the proposal:

- `lambda/` ingestion jobs and lightweight orchestration
- `sagemaker/` training and inference endpoints
- `eventbridge/` schedules and trigger rules
- `sns/` outbound alerting
- `dynamodb/` low-latency caches / materialized results
- `timestream/` telemetry-oriented time-series storage

Use this folder for Terraform, CDK, or CloudFormation once you choose one.
'@

$scriptReadme = @'
# Scripts

`scaffold_reefpulse_repo.ps1` is safe to rerun.

- Run without `-Force` to preserve existing files.
- Run with `-Force` if you want to overwrite the starter templates.
'@

Ensure-File -Path (Join-Path $root "README.md") -Content $rootReadme
Ensure-File -Path (Join-Path $root ".gitignore") -Content $gitignore
Ensure-File -Path (Join-Path $root "backend/README.md") -Content $backendReadme
Ensure-File -Path (Join-Path $root "backend/pyproject.toml") -Content $pyproject
Ensure-File -Path (Join-Path $root "backend/.env.example") -Content $envExample
Ensure-File -Path (Join-Path $root "backend/app/__init__.py") -Content ""
Ensure-File -Path (Join-Path $root "backend/app/main.py") -Content $mainPy
Ensure-File -Path (Join-Path $root "backend/app/core/__init__.py") -Content ""
Ensure-File -Path (Join-Path $root "backend/app/core/config.py") -Content $configPy
Ensure-File -Path (Join-Path $root "backend/app/api/__init__.py") -Content ""
Ensure-File -Path (Join-Path $root "backend/app/api/routes/__init__.py") -Content $routesInit
Ensure-File -Path (Join-Path $root "backend/app/api/routes/health.py") -Content $healthPy
Ensure-File -Path (Join-Path $root "backend/app/api/routes/forecast.py") -Content $forecastPy
Ensure-File -Path (Join-Path $root "backend/app/api/routes/safety.py") -Content $safetyPy
Ensure-File -Path (Join-Path $root "backend/app/api/routes/species.py") -Content $speciesPy
Ensure-File -Path (Join-Path $root "backend/app/api/routes/alerts.py") -Content $alertsPy
Ensure-File -Path (Join-Path $root "backend/app/api/routes/chat.py") -Content $chatPy
Ensure-File -Path (Join-Path $root "backend/app/clients/__init__.py") -Content ""
Ensure-File -Path (Join-Path $root "backend/app/clients/scripps_client.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/clients/noaa_client.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/clients/inaturalist_client.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/clients/aws_clients.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/ml/__init__.py") -Content ""
Ensure-File -Path (Join-Path $root "backend/app/ml/model_registry.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/ml/inference_router.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/pipelines/__init__.py") -Content ""
Ensure-File -Path (Join-Path $root "backend/app/pipelines/ingest_scripps.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/pipelines/ingest_noaa.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/pipelines/ingest_inaturalist.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/pipelines/feature_builder.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/repositories/__init__.py") -Content ""
Ensure-File -Path (Join-Path $root "backend/app/repositories/forecast_repository.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/repositories/species_repository.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/repositories/advisory_repository.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/schemas/__init__.py") -Content ""
Ensure-File -Path (Join-Path $root "backend/app/schemas/common.py") -Content $schemaCommon
Ensure-File -Path (Join-Path $root "backend/app/schemas/forecast.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/schemas/safety.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/schemas/species.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/schemas/alerts.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/schemas/chat.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/services/__init__.py") -Content ""
Ensure-File -Path (Join-Path $root "backend/app/services/forecast_service.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/services/anomaly_service.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/services/hab_service.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/services/species_service.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/services/safety_index_service.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/services/alert_service.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/services/chat_service.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/workers/__init__.py") -Content ""
Ensure-File -Path (Join-Path $root "backend/app/workers/event_consumer.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/app/workers/alert_dispatcher.py") -Content $placeholderModule
Ensure-File -Path (Join-Path $root "backend/tests/__init__.py") -Content ""
Ensure-File -Path (Join-Path $root "backend/tests/test_health.py") -Content $testHealth
Ensure-File -Path (Join-Path $root "docs/architecture/README.md") -Content $docsArchitecture
Ensure-File -Path (Join-Path $root "infra/aws/README.md") -Content $awsReadme
Ensure-File -Path (Join-Path $root "scripts/README.md") -Content $scriptReadme

Ensure-GitKeep -DirectoryPath (Join-Path $root "infra/aws/lambda")
Ensure-GitKeep -DirectoryPath (Join-Path $root "infra/aws/sagemaker")
Ensure-GitKeep -DirectoryPath (Join-Path $root "infra/aws/eventbridge")
Ensure-GitKeep -DirectoryPath (Join-Path $root "infra/aws/sns")
Ensure-GitKeep -DirectoryPath (Join-Path $root "infra/aws/dynamodb")
Ensure-GitKeep -DirectoryPath (Join-Path $root "infra/aws/timestream")

Write-Host ""
Write-Host "Scaffold complete."
Write-Host "Next suggested commands:"
Write-Host "  git init"
Write-Host "  cd backend"
Write-Host "  python -m venv .venv"
Write-Host "  .\.venv\Scripts\Activate.ps1"
Write-Host "  pip install -e .[dev]"
Write-Host "  uvicorn app.main:app --reload"
