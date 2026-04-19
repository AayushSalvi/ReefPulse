# ReefPulse — Backend Integration & Multi-Account AWS Setup

**Purpose:** Wire Model A, Model B, and Model D SageMaker endpoints into one shared backend when models may live in different AWS accounts.

**Security:** Never post IAM access keys, Google API keys, or secrets in Slack or commit them to git. Share credentials only through an approved secret channel; rotate any key that was exposed in chat.

---

## 1. Architecture Overview

### Who owns what

| Resource | AWS Account | Owner |
|----------|-------------|--------|
| Backend (FastAPI) | Account 1 (shared / deploy) | Backend owner |
| Model B SageMaker endpoint | Account 1 | Backend owner |
| Shared S3 bucket for raw data | Account 1 | Backend owner |
| Model A SageMaker endpoint | Account 2 | Teammate A |
| Model D SageMaker endpoint | Account 3 | Teammate D |

### Call flow at inference time

```
User request
    │
    ▼
Backend (Account 1)
    │
    ├── Model B (same account)     → default AWS credential chain
    ├── Model A (Teammate A)       → dedicated boto3 client + A’s keys
    └── Model D (Teammate D)       → dedicated boto3 client + D’s keys
```

---

## 2. Decisions to Lock First

### 2.1 AWS Region

Pick **one** region; all three endpoints should match.

- Recommended: `us-east-1` or `us-west-2`
- **Decision:** ________________

### 2.2 Endpoint naming convention

| Model | Endpoint name |
|-------|----------------|
| A | `reefpulse-model-a` |
| B | `reefpulse-model-b` |
| D | `reefpulse-model-d` |

Do not rename endpoints in the 24 hours before a demo once the backend is wired.

### 2.3 Idle shutdown

Real-time endpoints bill while provisioned. Agree on overnight delete vs keep-warm for dev.

### 2.4 Credential lifecycle

Keys are hackathon-scoped; revoke after the event. Never commit `.env`.

---

## 3. What Each Teammate Sends the Backend Owner

### 3.0 Checklist (Teammate A — Model A)

- [ ] AWS account ID (12 digits)
- [ ] Region (matches §2.1)
- [ ] Endpoint name (`reefpulse-model-a`)
- [ ] IAM user access key ID + secret (invoke-only user; see §4)
- [ ] **Input JSON schema** the SageMaker container expects
- [ ] **Output JSON schema** the container returns

### 3.0b Checklist (Teammate D — Model D)

Same pattern with `reefpulse-model-d` and species contract.

### 3.1 Model A — Create the SageMaker **model** resource (console)

When **Create model** runs after training, settings must match hosting expectations and §2.2 naming downstream.

| Field | Required |
|-------|-----------|
| **Model data URL** | S3 URI of training output `model.tar.gz` (same object the training job wrote). |
| **ECR image** | **PyTorch *inference*** DLC for your PyTorch/Python version, e.g. `763104351884.dkr.ecr.<region>.amazonaws.com/pytorch-inference:2.2.0-cpu-py310`. **Do not** use `pytorch-training`; the container will fail ping with `serve: command not found`. |
| **IAM role** | SageMaker execution role that can pull the image and, if needed, read `model.tar.gz` from S3. |
| **Inference handler** | If logs after image fix mention missing `inference.py` or load errors, repackage `model.tar.gz` with `code/inference.py` (and dependencies) aligned to the agreed JSON I/O in §3. |

Then create **endpoint configuration** + **endpoint** named **`reefpulse-model-a`** (or create under a temporary name and rename only if your process allows; prefer the agreed name from the start).

---

## 4. IAM: Invoke-Only User (Teammates A & D)

Create IAM user `reefpulse-backend-caller` (programmatic access only). Attach an inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sagemaker:InvokeEndpoint",
      "Resource": "arn:aws:sagemaker:REGION:ACCOUNT_ID:endpoint/ENDPOINT_NAME"
    }
  ]
}
```

Use `ENDPOINT_NAME` = `reefpulse-model-a` or `reefpulse-model-d` as appropriate. Send access key ID + secret + account ID + region to the backend owner via a **secret** channel.

---

## 5. Backend `.env` (do not commit)

Placeholders — copy to `backend/.env` and fill in.

```bash
AWS_REGION=us-east-1

# Model B (same account as backend)
SAGEMAKER_ENDPOINT_ANOMALY=reefpulse-model-b
USE_SAGEMAKER_ANOMALY=true

# Model A (cross-account — Teammate A)
SAGEMAKER_ENDPOINT_FORECAST=reefpulse-model-a
MODEL_A_AWS_ACCESS_KEY_ID=CHANGEME
MODEL_A_AWS_SECRET_ACCESS_KEY=CHANGEME
MODEL_A_AWS_ACCOUNT_ID=CHANGEME
USE_SAGEMAKER_FORECAST=true

# Model D (cross-account — Teammate D)
SAGEMAKER_ENDPOINT_SPECIES=reefpulse-model-d
MODEL_D_AWS_ACCESS_KEY_ID=CHANGEME
MODEL_D_AWS_SECRET_ACCESS_KEY=CHANGEME
MODEL_D_AWS_ACCOUNT_ID=CHANGEME
USE_SAGEMAKER_SPECIES=true
```

Commit **`backend/.env.example`** with the same keys and `CHANGEME` values (no real secrets).

---

## 6. Implementation Phases (recommended order)

1. **Model B** same-account — prove `sagemaker-runtime` + schema mapping in `anomaly_service.py`.
2. **Model A** cross-account — `forecast_service.py` + dedicated client using `MODEL_A_*` keys.
3. **Model D** — mirror Model A pattern in `species_service.py`.
4. **Cascade** (optional) — pipeline A → B in one route.
5. **Health** — aggregate status for all three.

---

## 7. Files to Touch (when implementing)

| File | Change |
|------|--------|
| `backend/.env` / `.env.example` | New vars |
| `backend/app/core/config.py` | Pydantic settings |
| `backend/app/clients/aws_clients.py` | Per-account SageMaker runtime clients |
| `backend/app/services/anomaly_service.py` | SageMaker path for B |
| `backend/app/services/forecast_service.py` | SageMaker path for A |
| `backend/app/services/species_service.py` | SageMaker path for D |
| `backend/app/api/routes/health.py` | Optional deep checks |

---

## 8. S3 data sharing (optional)

If teammates need read access to a shared CalCOFI bucket in Account 1, use a bucket policy with their account principals, or duplicate data to their buckets (simpler).

---

## 9. Pre-demo checklist

- Health route shows OK for wired endpoints.
- `curl` / Postman against each endpoint with sample JSON.
- No credential rotation in the last 24h before demo.
- Credits / endpoints warm.

---

## 10. Risk register (short)

| Risk | Mitigation |
|------|------------|
| Wrong DLC image on Model A | Use **inference** image; see §3.1 |
| Keys in git | `.gitignore` `.env`; pre-push review |
| Endpoint cold | Start endpoints ≥2h before demo |

---

## 11. Open questions

Fill as you go: locked region, actual endpoint names if different, cascade vs independent demo, who runs backend live.

---

## Appendix — Useful CLI

```bash
aws sagemaker describe-endpoint --endpoint-name reefpulse-model-a --region us-east-1
```

Cross-account test (teammate’s keys in env):

```bash
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
aws sagemaker-runtime invoke-endpoint \
  --endpoint-name reefpulse-model-a \
  --region us-east-1 \
  --content-type application/json \
  --body file://sample.json \
  /tmp/out.json
```

Stop billing when done:

```bash
aws sagemaker delete-endpoint --endpoint-name reefpulse-model-a --region us-east-1
```

---

**Model A detail runbook:** `docs/model-a/README.md` (training + artifact layout). **This doc:** integration contracts, naming, IAM, env vars, and **SageMaker model image** rules for hosting.
