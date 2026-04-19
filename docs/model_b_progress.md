# Model B Progress

Last updated: 2026-04-18

## Summary

Model B backend scaffolding is in place, the local backend environment is working, CalCOFI raw data is downloaded and uploaded to S3, a first-pass feature pipeline has been built from the real CalCOFI Bottle/Cast schema, an Isolation Forest baseline has been run, a CCE mooring sample has been processed end to end, and the SageMaker training/package path has been smoke-tested.

The current architectural understanding is:

- CalCOFI is valid for historical baseline / climatology.
- CCE Moorings should be added as the main modern / operational state source.
- Model B trains independently offline on source data.
- Model B scores live observed state or Model A forecast only at inference time.

## Completed

### Backend setup

- Created and verified the local backend environment in `backend/.venv`.
- Installed project dependencies with editable install support.
- Fixed packaging discovery in `backend/pyproject.toml` so editable installs do not try to package `training/` and `notebooks/`.
- Verified the API schema locally and confirmed `POST /api/v1/anomaly/score` exists.

### Model B backend scaffolding

- Added anomaly API route in `backend/app/api/routes/anomaly.py`.
- Added request/response models in `backend/app/schemas/anomaly.py`.
- Added scoring logic in `backend/app/services/anomaly_service.py`.
- Added model-loading hook in `backend/app/ml/model_registry.py`.
- Added baseline helper in `backend/app/ml/baselines.py`.
- Added training/inference stubs in:
  - `backend/training/model_b/train.py`
  - `backend/training/model_b/inference.py`
  - `backend/training/model_b/train_baseline.py`

### AWS and raw data ingestion

- AWS CLI access was configured and verified with STS.
- Created S3 bucket:
  - `s3://reefpulse-dev-aayush-656732270977`
- Created S3 prefixes:
  - `raw/calcofi/`
  - `processed/`
  - `models/model_b/`
- Downloaded official CalCOFI export locally.
- Uploaded raw source files to S3:
  - `s3://reefpulse-dev-aayush-656732270977/raw/calcofi/bottle_db.csv`
  - `s3://reefpulse-dev-aayush-656732270977/raw/calcofi/cast_db.csv`

### Feature engineering from real CalCOFI schema

- Inspected the actual downloaded CSVs and mapped the real columns.
- Confirmed Bottle columns:
  - `Cst_Cnt`
  - `Depthm`
  - `T_degC`
  - `Salnty`
  - `O2ml_L`
  - `ChlorA`
- Confirmed Cast columns:
  - `Cst_Cnt`
  - `Date`
  - `Sta_ID`
  - `Lat_Dec`
  - `Lon_Dec`
- Updated `backend/app/pipelines/feature_builder.py` to:
  - join Bottle and Cast on `Cst_Cnt`
  - filter to post-1993
  - build 16 features at `10m`, `50m`, `100m`, `200m`
  - impute missing values with monthly climatology
  - split data by year
  - scale with `StandardScaler`
  - save outputs locally and to S3

### Processed Model B artifacts

Local artifacts:

- `backend/training/model_b/artifacts/processed/model_b_features.parquet`
- `backend/training/model_b/artifacts/processed/model_b_train.parquet`
- `backend/training/model_b/artifacts/processed/model_b_val.parquet`
- `backend/training/model_b/artifacts/processed/model_b_test.parquet`
- `backend/training/model_b/artifacts/processed/model_b_stats.json`

S3 artifacts:

- `s3://reefpulse-dev-aayush-656732270977/processed/model_b_features.parquet`
- `s3://reefpulse-dev-aayush-656732270977/processed/model_b/train.parquet`
- `s3://reefpulse-dev-aayush-656732270977/processed/model_b/val.parquet`
- `s3://reefpulse-dev-aayush-656732270977/processed/model_b/test.parquet`
- `s3://reefpulse-dev-aayush-656732270977/processed/model_b/stats.json`

Current split sizes:

- train: `5851`
- val: `326`
- test: `915`

### Isolation Forest baseline

- Ran the baseline using `backend/training/model_b/train_baseline.py`.
- Generated local artifacts:
  - `backend/training/model_b/artifacts/baseline/baseline_predictions.parquet`
  - `backend/training/model_b/artifacts/baseline/baseline_report.json`
  - `backend/training/model_b/artifacts/baseline/baseline_anomaly_timeseries.png`
- Reported metrics from the current Blob-proxy framing:
  - ROC AUC: `0.4799`
  - Average precision: `0.7134`
  - Threshold: `0.5312`

Interpretation:

- the baseline pipeline is functioning
- the current evaluation framing is weak
- the baseline does not yet provide a strong anomaly-separation story

### CCE mooring local sample

- Downloaded a local mooring sample under:
  - `data/moorings/sample/`
- Inspected these files:
  - `OS_CCE1_17_D_CTD.nc`
  - `OS_CCE1_17_D_OXYGEN.nc`
  - `OS_CCE1_16_D_CHL.nc`
  - `OS_CCE2_16_D_CTD.nc`
  - `OS_CCE2_16_D_OXYGEN.nc`
  - `OS_CCE2_16_D_CHL.nc`

Confirmed variables:

- CTD files: `TEMP`, `PSAL`
- oxygen files: `DOX2`
- chlorophyll files: `CHL`

Confirmed time coverage:

- `CCE1` sample: mostly `2024-04` to `2025-03`
- `CCE2` sample: mostly `2024-03` to `2024-06`

Confirmed the main modeling caveat:

- mooring depth grids do not match the CalCOFI `10m/50m/100m/200m` grid exactly
- mooring data needs its own feature representation or explicit depth-mapping strategy

### CCE mooring pipeline and S3 upload

- Added:
  - `backend/app/pipelines/ingest_mooring.py`
  - `backend/app/pipelines/process_mooring.py`
  - `backend/tests/test_mooring_pipeline.py`
- Implemented raw upload to:
  - `s3://reefpulse-dev-aayush-656732270977/raw/moorings/cce1/`
  - `s3://reefpulse-dev-aayush-656732270977/raw/moorings/cce2/`
- Implemented processed output upload to:
  - `s3://reefpulse-dev-aayush-656732270977/processed/model_b/moorings_state_vectors.parquet`
  - `s3://reefpulse-dev-aayush-656732270977/processed/model_b/moorings_state_vectors_metadata.json`
- Normalized swapped coordinates in the `CCE2` oxygen file.
- Changed depth selection to choose the best usable sensor by QC-filtered observation count.
- Current mooring depth bands are:
  - shallow = `0m-25m`
  - mid = `25m-100m`
  - deep = `100m-300m`
- Verified local pipeline tests:
  - `5 passed`

### SageMaker-ready training path

- Refactored `backend/training/model_b/train.py` so it supports:
  - local parquet inputs
  - SageMaker channel inputs
  - local artifact/report outputs
  - SageMaker model/output directories
- Added:
  - `backend/training/model_b/package_model.py`
  - `backend/training/model_b/submit_training_job.py`
  - `backend/training/model_b/deploy_sagemaker.py`
- Ran a one-epoch local smoke test and created:
  - `backend/training/model_b/artifacts/vae_smoke/model/model_b.pt`
  - `backend/training/model_b/artifacts/vae_smoke/model/model_b_stats.json`
  - `backend/training/model_b/artifacts/vae_smoke/reports/vae_report.json`
  - `backend/training/model_b/artifacts/vae_smoke/reports/vae_predictions.parquet`
  - `backend/training/model_b/artifacts/vae_smoke/model_b.tar.gz`
- Uploaded smoke package to:
  - `s3://reefpulse-dev-aayush-656732270977/models/model_b/model_b_smoke.tar.gz`

## Important correction

### What we originally did

We built the first Model B pipeline from CalCOFI Bottle/Cast as if it were the full anomaly dataset.

### Why that is incomplete

Model B is described as:

- anomaly detection on ocean state vectors
- near-real-time scoring
- marine heatwave / acidification detection
- downstream scoring on live state or Model A forecast

CalCOFI is useful for historical baseline learning, but it is sparse and cruise-based. That makes it a weak sole dataset for the operational anomaly-detection story.

### Correct framing going forward

- Use CalCOFI for historical baseline / climatology.
- Add CCE Moorings for dense modern state vectors and operational scoring.
- Train Model B independently offline.
- At inference, score either:
  - live observed state
  - Model A forecasted state

## What is not finished yet

- The current mooring upload is only a validated sample, not a full backfill.
- The VAE has only been smoke-tested locally, not fully trained for production.
- A real SageMaker training job has not been submitted yet.
- A real SageMaker endpoint has not been deployed yet.
- The anomaly detector has not been wired into a true Model A forecast cascade yet.
- No final judge-facing model card has been written yet.

## Next steps

1. Decide the final Model B data strategy:
   - CalCOFI baseline + mooring inference
   - or hybrid CalCOFI + mooring training
2. Expand mooring ingestion beyond the six-file validated sample.
3. Run a real VAE training job beyond the one-epoch smoke test.
4. Submit the real SageMaker training job using `submit_training_job.py`.
5. Package and deploy the final artifact using `deploy_sagemaker.py`.
6. Update the service layer so Model B can score:
   - observed live state
   - Model A forecast state

## Notes for teammates

- The CalCOFI pipeline work should be kept, not discarded.
- It is valid as historical baseline preparation.
- The next major addition is mooring data, not a rewrite from scratch.
- The current backend and S3 setup are already useful and reusable for the next phase.
- See `docs/model_b_next_steps.md` for the short execution plan.
