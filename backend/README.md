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

## Run locally

Requires **Python 3.10+** from the `backend/` directory.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --reload-dir app
```

Use `--reload-dir app` so the file watcher does not scan `.venv` (otherwise reload loops while dependencies install or update). API base: **http://127.0.0.1:8000** · OpenAPI: **http://127.0.0.1:8000/docs**.

Optional env file: **`backend/.env`** (see `app/core/config.py` for variables such as `DATABASE_URL`, `JWT_SECRET`, `MODEL_A_ARTIFACT_PATH`).
