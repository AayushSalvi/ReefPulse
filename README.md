# ReefPulse

Ocean intelligence for the California coast: forecasting, HAB risk, species discovery, Surf Safety fusion, and AWS-backed serving (see proposal PDF in repo).

## Layout

| Path | Purpose |
|------|---------|
| `backend/` | FastAPI app, Model A code, services, tests |
| `docs/` | Architecture notes, **Model A runbook** → `docs/model-a/README.md` |
| `infra/aws/` | AWS placeholders + **SageMaker Model A** shell helper |
| `scripts/` | `launch_model_a_sagemaker_training.py`, SageMaker pip requirements |

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
