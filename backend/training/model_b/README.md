# Model B Training

This folder is the training workspace for the ReefPulse anomaly detector.

Current implementation and status notes live in:

- `docs/model_b_progress.md`
- `docs/model_b_next_steps.md`
- `docs/model_b_llm_handoff.md`
- `docs/model_b_aws_sagemaker.md`

Recommended flow:

1. Use `backend/app/pipelines/ingest_scripps.py` to upload raw CalCOFI data to S3.
2. Use `backend/app/pipelines/feature_builder.py` to create the 16-feature Model B matrix.
3. Train the baseline first with `IsolationForest`.
4. Train the VAE with `train.py`.
5. Package the trained artifact with `package_model.py`.
6. Submit training / deploy jobs with:
   - `submit_training_job.py`
   - `deploy_sagemaker.py`

Expected artifacts:

- `model_b.pt` for the VAE weights
- `model_b_stats.json` for feature statistics used by inference
- evaluation plots and notes for demo / judging
