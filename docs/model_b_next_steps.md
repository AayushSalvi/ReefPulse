# Model B Next Steps

Last updated: 2026-04-18

## Immediate goal

Move Model B from a CalCOFI-only historical baseline into a stronger operational anomaly-detection pipeline that includes recent CCE mooring state vectors.

## Current facts

- CalCOFI historical pipeline exists and should be kept.
- Processed CalCOFI Model B splits already exist locally and in S3.
- Isolation Forest baseline has been run, but the current Blob-proxy evaluation is weak.
- Recent CCE mooring sample files were downloaded and inspected locally.
- The mooring files contain the right variable families for Model B:
  - temperature
  - salinity
  - oxygen
  - chlorophyll
- Mooring depths do not match the CalCOFI `10m/50m/100m/200m` grid exactly.

## Recommended sequence

### 1. Build mooring ingestion

Create:

- `backend/app/pipelines/ingest_mooring.py`

Responsibilities:

- read local / remote `.nc` files
- support CCE1 and CCE2 sample files
- extract:
  - `TIME`
  - `DEPTH`
  - `TEMP`
  - `PSAL`
  - `DOX2`
  - `CHL`
  - QC fields where available

### 2. Define a mooring state-vector representation

Do not force CalCOFI depth bins yet.

Preferred options:

- nearest-depth mapping to a small target set
- or grouped levels such as:
  - shallow
  - mid
  - deep

This should be decided explicitly in code and documentation.

### 3. Validate locally before more S3 upload

Use the existing local sample folder:

- `data/moorings/sample/`

Confirm:

- variable names are stable
- QC handling is reasonable
- time alignment across CTD / OXYGEN / CHL is workable
- resulting state vectors are not mostly empty

### 4. Upload validated mooring raw files to S3

Only after the sample parser is accepted.

Suggested prefix:

- `raw/moorings/cce1/`
- `raw/moorings/cce2/`

### 5. Decide Model B data strategy

Best near-term options:

- `Option A`
  - train on CalCOFI historical baseline
  - evaluate and infer on moorings

- `Option B`
  - hybrid CalCOFI + moorings training
  - moorings for evaluation and inference

### 6. Train the VAE

After the mooring decision is made:

- run the VAE on the chosen feature set
- generate:
  - scored parquet
  - JSON report
  - anomaly time-series plot
  - top anomalous dates

### 7. Wire inference path

Update the service layer so Model B can score:

- observed live mooring state
- Model A forecast state

## Files to keep in mind

- `backend/app/pipelines/feature_builder.py`
- `backend/training/model_b/train.py`
- `backend/training/model_b/train_baseline.py`
- `backend/app/services/anomaly_service.py`
- `docs/model_b_progress.md`
- `docs/model_b_llm_handoff.md`

## Avoid these mistakes

- Do not retrain Model B on Model A outputs.
- Do not assume every sample in a historical event window is anomalous.
- Do not force mooring data into the CalCOFI depth grid without checking coverage.
- Do not upload large batches of mooring files to S3 before validating the parser locally.
