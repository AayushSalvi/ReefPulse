# iNaturalist fish Lambda (SAM)

This stack deploys the `inaturalist_usa_fish` package from `backend/` as a Lambda with an HTTP API (`GET /fish`).

## Build and deploy

From this directory:

```powershell
cd infra\aws\inaturalist-fish-lambda
sam build
sam deploy
```

- **Handler:** `inaturalist_usa_fish.lambda_handler.lambda_handler`
- **Code:** `backend/` (see `CodeUri` in `template.yaml`)
- **Dependencies for the build:** `backend/requirements.txt` (httpx only; SAM `python3.12` builder picks this up)

Use `sam build --use-container` if you add native dependencies and Docker Desktop is running.

## Example

```text
GET /fish?lat=32.8907&lon=-117.2535&radius_km=25
```

Optional query parameters match `lambda_handler` (e.g. `place_id`, `max_pages`, `quality_grade`).
