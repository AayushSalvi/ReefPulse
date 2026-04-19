# Model B Progress

Last updated: 2026-04-18

## Summary

Model B backend scaffolding is in place, the local backend environment is working, CalCOFI raw data is downloaded and uploaded to S3, a first-pass feature pipeline has been built from the real CalCOFI Bottle/Cast schema, an Isolation Forest baseline has been run, and a local CCE mooring sample has been downloaded and inspected.

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

- CCE Mooring ingestion pipeline has not been added yet.
- Mooring sample files have not yet been uploaded to S3.
- The VAE has not been trained on the processed features yet.
- The anomaly detector has not been wired into a true Model A forecast cascade yet.
- No final judge-facing model card has been written yet.

## Next steps

1. Add `backend/app/pipelines/ingest_mooring.py` for CCE Mooring data.
2. Build a mooring feature pipeline that produces current-state vectors compatible with Model B.
3. Choose a mooring depth strategy:
   - nearest-depth mapping
   - or shallow / mid / deep grouped representation
4. Upload the validated mooring sample files to S3 after the parser shape is agreed.
5. Decide whether Model B training is:
   - CalCOFI baseline + mooring inference
   - or hybrid CalCOFI + mooring training
6. Train the VAE after the baseline and evaluation framing are locked.
7. Update the service layer so Model B can score:
   - observed live state
   - Model A forecast state

## Notes for teammates

- The CalCOFI pipeline work should be kept, not discarded.
- It is valid as historical baseline preparation.
- The next major addition is mooring data, not a rewrite from scratch.
- The current backend and S3 setup are already useful and reusable for the next phase.
- See `docs/model_b_next_steps.md` for the short execution plan.
