# Model B AWS + SageMaker Status

Last updated: 2026-04-18

## What is already in S3

Bucket:

- `s3://reefpulse-dev-aayush-656732270977`

Raw CalCOFI:

- `raw/calcofi/bottle_db.csv`
- `raw/calcofi/cast_db.csv`

Raw mooring sample:

- `raw/moorings/cce1/OS_CCE1_16_D_CHL.nc`
- `raw/moorings/cce1/OS_CCE1_17_D_CTD.nc`
- `raw/moorings/cce1/OS_CCE1_17_D_OXYGEN.nc`
- `raw/moorings/cce2/OS_CCE2_16_D_CHL.nc`
- `raw/moorings/cce2/OS_CCE2_16_D_CTD.nc`
- `raw/moorings/cce2/OS_CCE2_16_D_OXYGEN.nc`

Processed CalCOFI Model B:

- `processed/model_b/train.parquet`
- `processed/model_b/val.parquet`
- `processed/model_b/test.parquet`
- `processed/model_b/stats.json`

Processed mooring state vectors:

- `processed/model_b/moorings_state_vectors.parquet`
- `processed/model_b/moorings_state_vectors_metadata.json`

Smoke-tested model artifact:

- `models/model_b/model_b_smoke.tar.gz`

## Scripts now available

Data ingestion and processing:

- `backend/app/pipelines/ingest_mooring.py`
- `backend/app/pipelines/process_mooring.py`

Model training and packaging:

- `backend/training/model_b/train.py`
- `backend/training/model_b/package_model.py`
- `backend/training/model_b/submit_training_job.py`
- `backend/training/model_b/deploy_sagemaker.py`
- `backend/training/model_b/inference.py`

## What was validated

- Local mooring parsing works for the current six-file sample.
- Swapped coordinates in `CCE2` oxygen were normalized.
- QC handling was relaxed to preserve valid observations.
- The processor now chooses the best depth by usable observations, not just nearest depth.
- The mooring processor writes:
  - local parquet + metadata
  - optional S3 parquet + metadata
- The VAE training script runs locally on processed parquet files.
- The packaging script creates a SageMaker-compatible `model.tar.gz`.

## Current mooring representation

The mooring pipeline uses grouped depth bands instead of forcing the CalCOFI `10/50/100/200m` grid:

- `shallow = 0m to 25m`
- `mid = 25m to 100m`
- `deep = 100m to 300m`

This avoids using ultra-deep sensors like `707m` as the "deep" feature for the demo feature vector.

## Important current limitation

The current mooring upload is only a validated sample, not a full historical backfill.

What exists now is enough to:

- prove the ingestion path
- prove the processing path
- prove the S3 layout
- prove the SageMaker packaging path

It is not yet the final production dataset for Model B.

## What is still needed for a real SageMaker deployment

1. A real IAM role ARN for SageMaker training and hosting.
2. A decision on the final training dataset:
   - CalCOFI only
   - moorings only
   - hybrid CalCOFI + moorings
3. A real VAE training run beyond the one-epoch smoke test.
4. Packaging the final model artifact and uploading it to `models/model_b/`.
5. Running:
   - `submit_training_job.py`
   - `deploy_sagemaker.py`
6. Updating the backend config so `SAGEMAKER_ENDPOINT_ANOMALY` points to the deployed endpoint.

## Useful command patterns

Run mooring upload:

```powershell
$env:PYTHONPATH='C:\UCSD\hackathon_reef\backend'
& 'C:\Users\salvi\AppData\Local\Programs\Python\Python311\python.exe' -m app.pipelines.ingest_mooring --output-dir "C:\UCSD\hackathon_reef\data\moorings\sample" --bucket reefpulse-dev-aayush-656732270977 --upload-s3
```

Run mooring processing:

```powershell
$env:PYTHONPATH='C:\UCSD\hackathon_reef\backend'
& 'C:\Users\salvi\AppData\Local\Programs\Python\Python311\python.exe' -m app.pipelines.process_mooring --input-dir "C:\UCSD\hackathon_reef\data\moorings\sample" --output-dir "C:\UCSD\hackathon_reef\backend\training\model_b\artifacts\mooring" --bucket reefpulse-dev-aayush-656732270977
```

Run local VAE training:

```powershell
& 'C:\Users\salvi\AppData\Local\Programs\Python\Python311\python.exe' backend\training\model_b\train.py --train-parquet "C:\UCSD\hackathon_reef\backend\training\model_b\artifacts\processed\model_b_train.parquet" --val-parquet "C:\UCSD\hackathon_reef\backend\training\model_b\artifacts\processed\model_b_val.parquet" --test-parquet "C:\UCSD\hackathon_reef\backend\training\model_b\artifacts\processed\model_b_test.parquet"
```

Package for SageMaker:

```powershell
& 'C:\Users\salvi\AppData\Local\Programs\Python\Python311\python.exe' backend\training\model_b\package_model.py --model-dir "C:\UCSD\hackathon_reef\backend\training\model_b\artifacts\vae_smoke\model" --output-tarball "C:\UCSD\hackathon_reef\backend\training\model_b\artifacts\vae_smoke\model_b.tar.gz"
```
