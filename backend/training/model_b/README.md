# Model B Training

This folder is the training workspace for the ReefPulse anomaly detector.

Recommended flow:

1. Use `backend/app/pipelines/ingest_scripps.py` to upload raw CalCOFI data to S3.
2. Use `backend/app/pipelines/feature_builder.py` to create the 16-feature Model B matrix.
3. Train the baseline first with `IsolationForest`.
4. Train the VAE with `train.py`.
5. Save artifacts in `artifacts/` and upload production models to S3.

Expected artifacts:

- `model_b.pt` for the VAE weights
- `model_b_stats.json` for feature statistics used by inference
- evaluation plots and notes for demo / judging
