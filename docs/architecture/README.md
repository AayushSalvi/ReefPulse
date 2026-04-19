# Architecture Notes

Backend responsibilities inferred from the ReefPulse proposal:

1. Ingest Scripps, NOAA, and iNaturalist data sources.
2. Expose forecast, safety, species, alert, and chat APIs.
3. Orchestrate model inference and the Surf Safety Index.
4. Support event-driven alerting and AWS deployment.
5. Keep the system modular enough for hackathon-speed iteration.

Model A (state forecaster) pipeline and SageMaker steps: `../model-a/README.md`.
