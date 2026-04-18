# AWS Infra

Suggested ownership from the proposal:

- `lambda/` ingestion jobs and lightweight orchestration
- `sagemaker/` training and inference endpoints
- `eventbridge/` schedules and trigger rules
- `sns/` outbound alerting
- `dynamodb/` low-latency caches / materialized results
- `timestream/` telemetry-oriented time-series storage

Use this folder for Terraform, CDK, or CloudFormation once you choose one.
