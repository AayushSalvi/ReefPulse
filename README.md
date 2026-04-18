# ReefPulse

ReefPulse is an ocean intelligence web app for the California coast. Based on the project proposal, the backend needs to support:

- condition and hazard forecasting
- harmful algal bloom alerts
- marine life discovery predictions
- a Surf Safety Index fusion layer
- chatbot / question-answering hooks
- event-driven alerting and AWS deployment

This scaffold is organized so the backend can move quickly while still matching the proposal architecture.

## Suggested repo layout

- `backend/` FastAPI app, service layer, model adapters, ingestion jobs, tests
- `docs/` system notes, architecture, API decisions
- `infra/aws/` infrastructure as code and deployment assets
- `scripts/` local setup and project automation

## Quick start

1. Initialize git when you are ready:
   `git init`
2. Review or edit the scaffold:
   `powershell -ExecutionPolicy Bypass -File .\scripts\scaffold_reefpulse_repo.ps1`
3. Commit and push to GitHub after you add your real backend code.
