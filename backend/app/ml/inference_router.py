"""Route inference to Model A (local checkpoint); extend for SageMaker runtime later."""

from __future__ import annotations

from app.ml.model_a.inference import load_forecaster

__all__ = ["load_forecaster"]
