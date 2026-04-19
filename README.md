# ReefPulse

Ocean intelligence for the California coast: forecasting, HAB risk, species discovery, Surf Safety fusion, and AWS-backed serving (see proposal PDF in repo).

## Layout

| Path | Purpose |
|------|---------|
| `backend/` | FastAPI app, Model A / **Model D** integration, services, tests |
| `backend/inaturalist_usa_fish/` | USA marine fish helper + optional Lambda (`infra/aws/inaturalist-fish-lambda/`) |
| `docs/` | Architecture notes, **Model A runbook** → `docs/model-a/README.md` |
| `infra/aws/` | AWS placeholders + **SageMaker Model A** shell helper |
| `scripts/` | `launch_model_a_sagemaker_training.py`, SageMaker pip requirements |

## Model D — Likelihood of fish at a location (SageMaker)

**Goal:** **Model D** estimates **how likely different fish species are to be found** at a **location**—given **latitude/longitude** and optional **observation date**, it returns **ranked likelihoods** for the **top‑k** species from an AWS **SageMaker real-time endpoint** (JSON request/response). In plain terms: *“If you looked here (and when), what fish would you most expect to encounter?”*

**What changed in this repo**

- **API:** `GET /api/v1/species/{location_slug}?lat=&lon=&date=&top_k=` — see `backend/app/api/routes/species.py`.
- **Service:** `backend/app/services/species_service.py` builds the payload (`latitude`, `longitude`, optional `date`, `top_k`) and invokes SageMaker via `invoke_sagemaker_json`.
- **Routing:** logical key `SPECIES_FISH_RANKED` → endpoint name from settings — `backend/app/ml/model_registry.py`.
- **AWS:** shared SageMaker Runtime client — `backend/app/clients/aws_clients.py`.
- **Config:** `sagemaker_endpoint_species` (environment variable **`SAGEMAKER_ENDPOINT_SPECIES`**, default **`fish-sd-top100`**) in `backend/app/core/config.py`. Set this to your deployed endpoint name in `.env`.

**Related:** The **`inaturalist_usa_fish`** package supports iNaturalist-based discovery workflows and an optional **SAM Lambda** (`infra/aws/inaturalist-fish-lambda/README.md`); Model D inference in the FastAPI app is SageMaker-backed as above.

## Model A (State Forecaster)

End-to-end steps (local windows, S3, SageMaker, API): **`docs/model-a/README.md`**

Quick local train (small subset, CPU-friendly):

```bash
cd backend && pip install -e ".[model-a]"
python -m app.ml.model_a build-windows --features /path/to/calcofi_features.parquet --out-dir ./model_a_data
python -m app.ml.model_a train --train-npz ./model_a_data/train.npz --val-npz ./model_a_data/val.npz --out ./model_A_forecaster.pt --epochs 10 --max-train-samples 40000 --max-val-samples 8000
```

## Backend dev

```bash
cd backend
pip install -e ".[dev]"
pytest tests/ -q
uvicorn app.main:app --reload
```

API docs: `http://127.0.0.1:8000/docs`
