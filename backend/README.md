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

## Model D — Likelihood of fish at a location (SageMaker)

**Model D** predicts **likelihoods for fish species found at a location**: the client sends **`latitude`/`longitude`**, optional **`date`**, and **`top_k`**; SageMaker returns **ranked species with likelihood scores** (exact JSON depends on your deployed model). The FastAPI route merges that with `location_slug` for the response.

| Piece | Location |
|-------|-----------|
| HTTP route | `app/api/routes/species.py` → `GET …/species/{location_slug}` |
| Inference call | `app/services/species_service.py` |
| SageMaker JSON helper | `app/ml/inference_router.py` (`invoke_sagemaker_json`) |
| Endpoint name mapping | `app/ml/model_registry.py` (`SPECIES_FISH_RANKED`, `endpoint_for`) |
| Endpoint configuration | `app/core/config.py` → **`sagemaker_endpoint_species`** (override with **`SAGEMAKER_ENDPOINT_SPECIES`** in `.env`) |

Tests: `tests/test_species.py`. Training and packaging for the endpoint itself live in your SageMaker / ML project; this repo wires **serving** and the **public API**.

## iNaturalist fish tool (Lambda-ready)

The standalone package `inaturalist_usa_fish/` (same layout as the DataHacks prototype) lives next to `app/`. It provides `fetch_fish_near`, a CLI entrypoint pattern, and `lambda_handler` for API Gateway. SAM deploy lives under `../infra/aws/inaturalist-fish-lambda/` (see that folder’s README). Use it alongside Model D for iNaturalist-driven discovery; the FastAPI species route uses Model D (SageMaker) as documented above.

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
