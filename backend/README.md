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

## Model A (State Forecaster)

Full runbook (windows → S3 → SageMaker → API): **`../docs/model-a/README.md`**

Install ML extras: `pip install -e ".[model-a]"` (PyTorch, pandas, pyarrow).
