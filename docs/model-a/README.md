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
  --instance-type ml.g4dn.xlarge \
  --epochs 20
```

**On your laptop**, add `--role arn:aws:iam::ACCOUNT:role/YOUR_SAGEMAKER_ROLE`.

Entry script: `backend/train_sagemaker_model_a.py`. Large local folders are excluded from the upload tarball via `backend/.sagemaker-ignore`.

Job output: `model.tar.gz` → extract → `model_A_forecaster.pt`.

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
