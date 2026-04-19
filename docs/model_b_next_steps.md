# Model B Next Steps

Last updated: 2026-04-18

## Immediate goal

Move Model B from a CalCOFI-only historical baseline into a stronger operational anomaly-detection pipeline that includes recent CCE mooring state vectors.

## Current facts

- CalCOFI historical pipeline exists and should be kept.
- Processed CalCOFI Model B splits already exist locally and in S3.
- Isolation Forest baseline has been run, but the current Blob-proxy evaluation is weak.
- Recent CCE mooring sample files were downloaded, processed locally, and uploaded to S3.
- The mooring files contain the right variable families for Model B:
  - temperature
  - salinity
  - oxygen
  - chlorophyll
- Mooring depths do not match the CalCOFI `10m/50m/100m/200m` grid exactly.
- The repo now includes SageMaker training / packaging / deploy scripts.

## Recommended sequence

### 1. Decide Model B data strategy

Best near-term options:

- `Option A`
  - train on CalCOFI historical baseline
  - evaluate and infer on moorings

- `Option B`
  - hybrid CalCOFI + moorings training
  - moorings for evaluation and inference

### 2. Expand the mooring dataset

The current S3 mooring data is only a validated sample. Next step is to ingest more deployments before treating it as the final operational dataset.

### 3. Run a real VAE training pass

After the data strategy is locked:

- run the VAE on the chosen feature set
- generate:
  - scored parquet
  - JSON report
  - anomaly time-series plot
  - top anomalous dates

### 4. Use the SageMaker path

Available scripts:

- `backend/training/model_b/submit_training_job.py`
- `backend/training/model_b/package_model.py`
- `backend/training/model_b/deploy_sagemaker.py`

What is still needed:

- a real SageMaker role ARN
- a final model artifact instead of the smoke-test package
- endpoint deployment and config wiring

### 5. Wire inference path

Update the service layer so Model B can score:

- observed live mooring state
- Model A forecast state

## Files to keep in mind

- `backend/app/pipelines/feature_builder.py`
- `backend/app/pipelines/ingest_mooring.py`
- `backend/app/pipelines/process_mooring.py`
- `backend/training/model_b/train.py`
- `backend/training/model_b/train_baseline.py`
- `backend/training/model_b/package_model.py`
- `backend/training/model_b/submit_training_job.py`
- `backend/training/model_b/deploy_sagemaker.py`
- `backend/app/services/anomaly_service.py`
- `docs/model_b_progress.md`
- `docs/model_b_llm_handoff.md`
- `docs/model_b_aws_sagemaker.md`

## Avoid these mistakes

- Do not retrain Model B on Model A outputs.
- Do not assume every sample in a historical event window is anomalous.
- Do not force mooring data into the CalCOFI depth grid without checking coverage.
- Do not mistake the current six-file mooring sample for the full production dataset.
