# Model B LLM Handoff

This document is for another LLM / coding agent picking up work on ReefPulse Model B.

## Project context

ReefPulse is an ocean intelligence platform. The relevant system intent for Model B is:

- Model B = anomaly detector
- architecture = variational autoencoder
- goal = score ocean state vectors and flag anomalous conditions
- outputs = anomaly score + per-variable attribution
- use cases = marine heatwaves, acidification, unusual stratification

Important architectural rule from the current system diagrams:

- training: all models train independently on ground-truth / source data
- inference: Model B can score live observed state or Model A forecast
- there is no model-to-model cascade during training
- the cascade happens only during inference

## Current architectural interpretation

The current best interpretation is:

- CalCOFI is useful for historical baseline / climatology
- CCE Moorings should be the main modern / operational state source
- Model B should not be framed as CalCOFI-only
- Model B inference should support:
  - direct observed current state vectors
  - Model A forecasted state vectors

So if continuing this work:

- keep the CalCOFI pipeline
- add mooring ingestion next
- do not discard the current feature engineering work

## What has already been done

### Backend and API

Local backend setup was completed and verified.

Relevant files:

- `backend/app/api/routes/anomaly.py`
- `backend/app/schemas/anomaly.py`
- `backend/app/services/anomaly_service.py`
- `backend/app/ml/model_registry.py`
- `backend/app/ml/baselines.py`
- `backend/app/core/config.py`

The API route exists:

- `POST /api/v1/anomaly/score`

### AWS / S3

AWS CLI is configured locally on this machine.

Current bucket:

- `s3://reefpulse-dev-aayush-656732270977`

Current relevant prefixes:

- `raw/calcofi/`
- `raw/moorings/`
- `processed/`
- `models/model_b/`

Uploaded raw source files:

- `s3://reefpulse-dev-aayush-656732270977/raw/calcofi/bottle_db.csv`
- `s3://reefpulse-dev-aayush-656732270977/raw/calcofi/cast_db.csv`
- `s3://reefpulse-dev-aayush-656732270977/raw/moorings/cce1/OS_CCE1_16_D_CHL.nc`
- `s3://reefpulse-dev-aayush-656732270977/raw/moorings/cce1/OS_CCE1_17_D_CTD.nc`
- `s3://reefpulse-dev-aayush-656732270977/raw/moorings/cce1/OS_CCE1_17_D_OXYGEN.nc`
- `s3://reefpulse-dev-aayush-656732270977/raw/moorings/cce2/OS_CCE2_16_D_CHL.nc`
- `s3://reefpulse-dev-aayush-656732270977/raw/moorings/cce2/OS_CCE2_16_D_CTD.nc`
- `s3://reefpulse-dev-aayush-656732270977/raw/moorings/cce2/OS_CCE2_16_D_OXYGEN.nc`

### CalCOFI local source files

Downloaded local files:

- `C:\UCSD\hackathon_reef\data\calcofi\unzipped\CalCOFI_Database_194903-202105_csv_16October2023\CalCOFI_Database_194903-202105_csv_16October2023\194903-202105_Bottle.csv`
- `C:\UCSD\hackathon_reef\data\calcofi\unzipped\CalCOFI_Database_194903-202105_csv_16October2023\CalCOFI_Database_194903-202105_csv_16October2023\194903-202105_Cast.csv`

Note:

- Bottle CSV required `encoding="latin1"` when read by pandas

### Real schema mapping already discovered

Bottle columns used:

- `Cst_Cnt`
- `Depthm`
- `T_degC`
- `Salnty`
- `O2ml_L`
- `ChlorA`

Cast columns used:

- `Cst_Cnt`
- `Date`
- `Sta_ID`
- `Lat_Dec`
- `Lon_Dec`

Join key:

- `Cst_Cnt`

### Feature pipeline

Relevant file:

- `backend/app/pipelines/feature_builder.py`

This file was refactored to:

- load Bottle + Cast
- join on `Cst_Cnt`
- filter to post-1993
- select target depths `10m`, `50m`, `100m`, `200m`
- build 16 Model B features
- impute with monthly climatology
- split by year:
  - train = 1993-2012
  - val = 2013
  - test = 2014-2016
- scale using `StandardScaler`
- save local parquet artifacts
- upload processed artifacts to S3

### Processed artifacts that already exist

Local:

- `backend/training/model_b/artifacts/processed/model_b_features.parquet`
- `backend/training/model_b/artifacts/processed/model_b_train.parquet`
- `backend/training/model_b/artifacts/processed/model_b_val.parquet`
- `backend/training/model_b/artifacts/processed/model_b_test.parquet`
- `backend/training/model_b/artifacts/processed/model_b_stats.json`

S3:

- `s3://reefpulse-dev-aayush-656732270977/processed/model_b_features.parquet`
- `s3://reefpulse-dev-aayush-656732270977/processed/model_b/train.parquet`
- `s3://reefpulse-dev-aayush-656732270977/processed/model_b/val.parquet`
- `s3://reefpulse-dev-aayush-656732270977/processed/model_b/test.parquet`
- `s3://reefpulse-dev-aayush-656732270977/processed/model_b/stats.json`

Observed split sizes:

- train = `5851`
- val = `326`
- test = `915`

### Isolation Forest baseline

Relevant files:

- `backend/app/ml/baselines.py`
- `backend/training/model_b/train_baseline.py`

The baseline was run successfully.

Generated local artifacts:

- `backend/training/model_b/artifacts/baseline/baseline_predictions.parquet`
- `backend/training/model_b/artifacts/baseline/baseline_report.json`
- `backend/training/model_b/artifacts/baseline/baseline_anomaly_timeseries.png`

Reported metrics:

- ROC AUC (Blob proxy): `0.4799`
- Average precision (Blob proxy): `0.7134`
- Threshold: `0.5312`

Interpretation:

- the training/evaluation path works
- the current Blob-proxy framing is weak
- do not oversell this baseline as strong anomaly validation

### CCE mooring local sample

A local sample of recent CCE mooring files was downloaded to:

- `C:\UCSD\hackathon_reef\data\moorings\sample`

Sample files inspected:

- `OS_CCE1_17_D_CTD.nc`
- `OS_CCE1_17_D_OXYGEN.nc`
- `OS_CCE1_16_D_CHL.nc`
- `OS_CCE2_16_D_CTD.nc`
- `OS_CCE2_16_D_OXYGEN.nc`
- `OS_CCE2_16_D_CHL.nc`

Observed useful variables:

- CTD files: `TEMP`, `PSAL`
- oxygen files: `DOX2`
- chlorophyll files: `CHL`

Observed time coverage:

- `CCE1` sample: mostly `2024-04` to `2025-03`
- `CCE2` sample: mostly `2024-03` to `2024-06`

Observed depth issue:

- mooring depth levels do not align exactly with CalCOFI `10/50/100/200m`
- do not force the same depth grid without a deliberate mapping strategy

### CCE mooring code that now exists

Relevant files:

- `backend/app/pipelines/ingest_mooring.py`
- `backend/app/pipelines/process_mooring.py`
- `backend/tests/test_mooring_pipeline.py`

Current behavior:

- raw mooring files can be uploaded to S3
- processed mooring state vectors can be written locally and to S3
- current depth bands are:
  - shallow = `0m-25m`
  - mid = `25m-100m`
  - deep = `100m-300m`
- `CCE2` oxygen coordinate swap is normalized
- depth selection is based on QC-filtered usable observations, not just nearest sensor

Current processed mooring artifacts in S3:

- `s3://reefpulse-dev-aayush-656732270977/processed/model_b/moorings_state_vectors.parquet`
- `s3://reefpulse-dev-aayush-656732270977/processed/model_b/moorings_state_vectors_metadata.json`

### SageMaker path that now exists

Relevant files:

- `backend/training/model_b/train.py`
- `backend/training/model_b/package_model.py`
- `backend/training/model_b/submit_training_job.py`
- `backend/training/model_b/deploy_sagemaker.py`
- `backend/training/model_b/inference.py`

What was validated:

- local VAE smoke training completed
- a SageMaker-compatible tarball was created
- smoke package uploaded to:
  - `s3://reefpulse-dev-aayush-656732270977/models/model_b/model_b_smoke.tar.gz`

## What is not complete

- the current mooring data in S3 is still only a validated sample
- the VAE has only been smoke-tested, not fully trained for production
- no real SageMaker training job has been submitted yet
- no real SageMaker endpoint has been deployed yet
- Model B is not yet wired into a real Model A forecast cascade at inference time

## Important caveats

### Main dataset caveat

Do not assume the current CalCOFI feature pipeline is the final or only Model B training source.

Current best understanding:

- CalCOFI = historical baseline
- CCE Mooring = needed next for operational / modern dense state vectors

### Training vs inference caveat

Do not wire Model A into Model B training.

Safe rule:

- training uses source data only
- inference may feed Model A forecast into Model B

### Encoding caveat

The Bottle CSV is not plain UTF-8. Use `latin1`.

### Repo hygiene caveat

There are unrelated untracked PNG files in the repo root:

- `b40e89cf-f7ec-4833-aab8-f9a85e992d98.png`
- `model_flow_diagram.png`

Do not assume they are disposable unless explicitly told to delete or commit them.

### Local config caveat

There is a local `backend/.env` file pointing at the real S3 bucket. Treat it as local environment state, not something to blindly rewrite or expose.

## Suggested next actions

1. Decide whether Model B training will be:
   - CalCOFI baseline + mooring inference only
   - or hybrid CalCOFI + mooring training
2. Expand mooring ingestion beyond the six-file sample
3. Run a real VAE training job beyond the smoke test
4. Deploy a real SageMaker endpoint after final packaging
5. Update `anomaly_service` so it explicitly supports:
   - scoring observed live state
   - scoring Model A forecast state

## Safe commands / entrypoints

Feature build from local files:

```powershell
C:\UCSD\hackathon_reef\backend\.venv\Scripts\python.exe -m app.pipelines.feature_builder --bottle-local "C:\UCSD\hackathon_reef\data\calcofi\unzipped\CalCOFI_Database_194903-202105_csv_16October2023\CalCOFI_Database_194903-202105_csv_16October2023\194903-202105_Bottle.csv" --cast-local "C:\UCSD\hackathon_reef\data\calcofi\unzipped\CalCOFI_Database_194903-202105_csv_16October2023\CalCOFI_Database_194903-202105_csv_16October2023\194903-202105_Cast.csv"
```

Local backend run:

```powershell
cd C:\UCSD\hackathon_reef\backend
C:\UCSD\hackathon_reef\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Related documentation

For a human-oriented status summary, also read:

- `docs/model_b_progress.md`
- `docs/model_b_next_steps.md`
- `docs/model_b_aws_sagemaker.md`
