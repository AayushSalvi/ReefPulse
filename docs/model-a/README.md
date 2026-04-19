# Model A — State Forecaster (SageMaker-ready)

**Goal:** 30-day multivariate input → **14-day** forecast of temperature, salinity, dissolved oxygen, chlorophyll-a, with **MC-dropout uncertainty** (p10 / p90 bands) at inference.

**Architecture:** Patch-style time transformer (`PatchTSTMini`) in `backend/app/ml/model_a/model.py`.

**Training data:** Per-station daily windows built from CalCOFI-style features (`feature_pipeline.py`). Mooring/glider streams are not bundled in this repo; at inference, any source can supply the same `(30, 4)` tensor.

---

## 1) Build window files (local or Studio)

From `backend/` with optional `[model-a]` install:

```bash
cd backend
pip install -e ".[model-a]"
python -m app.ml.model_a build-windows \
  --features /path/to/calcofi_features.parquet \
  --out-dir ./model_a_data
```

Produces `train.npz` and `val.npz` (gitignored).

### Improving Model A (training defaults in repo)

Training now uses by default:

- **SmoothL1 (Huber) loss** (`--huber-delta 1.0`) so chlorophyll / oxygen spikes do not dominate MSE.
- **Cosine LR schedule** and **AdamW weight decay** (`--weight-decay 0.02`).
- **Early stopping** on validation MSE (`--early-stopping-patience 8`; set `0` to disable).
- Slightly higher **dropout** in `PatchTSTMini`.

Example (local or job):

```bash
python -m app.ml.model_a train --train-npz ./model_a_data/train.npz --val-npz ./model_a_data/val.npz \
  --out ./model_A_forecaster.pt --epochs 40 --huber-delta 1.0 --early-stopping-patience 10
```

For SageMaker, add the same keys to hyperparameters, e.g. `huber-delta`, `early-stopping-patience`, `weight-decay`, or `disable-scheduler`=`true`.

---

## 2) Upload NPZ to S3 (same prefix)

Example:

```bash
aws s3 cp model_a_data/train.npz s3://YOUR_BUCKET/model-a/
aws s3 cp model_a_data/val.npz   s3://YOUR_BUCKET/model-a/
```

SageMaker expects **both files in one folder** passed as the `training` channel.

---

## 3) Train on SageMaker

**Studio (Code Editor / JupyterLab terminal)** — from repo root, after `pip install -r scripts/requirements-sagemaker.txt`:

```bash
python scripts/launch_model_a_sagemaker_training.py \
  --region us-east-1 \
  --s3-train-channel s3://YOUR_BUCKET/model-a/ \
  --output-path s3://YOUR_BUCKET/model-a/sagemaker-output/ \
  --epochs 20
```

The launcher defaults to **`ml.m5.xlarge` (CPU)** so new accounts are not blocked by **zero GPU quota**. For faster training, request a quota for **`ml.g4dn.xlarge` for training job usage`** in **AWS Service Quotas** (or Support), then run with `--instance-type ml.g4dn.xlarge`.

**On your laptop**, add `--role arn:aws:iam::ACCOUNT:role/YOUR_SAGEMAKER_ROLE`.

Entry script: `backend/train_sagemaker_model_a.py`. Large local folders are excluded from the upload tarball via `backend/.sagemaker-ignore`.

Job output: `model.tar.gz` → extract → `model_A_forecaster.pt`.

---

## 3b) How good is it? (RMSE / MAE in real units)

1. Download **`model.tar.gz`** from the training job output prefix in S3, unzip → `model_A_forecaster.pt`.
2. Have **`val.npz`** locally (same file family the job used; or download from `s3://.../model-a/val.npz`).
3. From **`backend/`** after `pip install -e ".[model-a]"`:

```bash
python -m app.ml.model_a.eval_checkpoint \
  --ckpt /path/to/model_A_forecaster.pt \
  --val-npz /path/to/val.npz \
  --max-samples 8000
```

This prints **per-channel RMSE and MAE** over all 14 forecast days (physical units), plus a rough MAPE line. Use `--max-samples 0` to score the full val set (slower).

---

## 4) Run API locally with a checkpoint

```bash
export MODEL_A_ARTIFACT_PATH=/absolute/path/to/model_A_forecaster.pt
cd backend && uvicorn app.main:app --reload
```

`POST /api/v1/forecasts/model-a` with JSON `past_series`: 30×4 in channel order  
`temp_c`, `salinity`, `oxygen_ml_l`, `chlorophyll_a`.

`GET /api/v1/forecasts/model-a/status` — whether the checkpoint loaded.

---

## 5) Studio upload limit (100 MiB)

Do **not** zip the whole repo with data. Use **git clone** in Studio, or a **small** zip (exclude `.venv`, `model_a_data`, `*.npz`, `*.pt`, `*.parquet`), or `aws s3 cp` for large artifacts.
