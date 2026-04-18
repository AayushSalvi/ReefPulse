# Backend

This backend scaffold follows the ReefPulse proposal:

- `api/routes/` public endpoints for forecasts, safety, species, alerts, and chat
- `services/` business logic and fusion logic
- `clients/` wrappers for NOAA, Scripps, iNaturalist, and AWS services
- `pipelines/` ingestion and feature-building jobs
- `ml/` model registry and inference routing
- `workers/` background processing and alert dispatch
- `repositories/` database / cache access

The starting assumption is Python + FastAPI because the proposal leans heavily on Python data and ML tooling.

## iNaturalist fish tool (Lambda-ready)

The standalone package `inaturalist_usa_fish/` (same layout as the DataHacks prototype) lives next to `app/`. It provides `fetch_fish_near`, a CLI entrypoint pattern, and `lambda_handler` for API Gateway. SAM deploy lives under `../infra/aws/inaturalist-fish-lambda/` (see that folder’s README).
