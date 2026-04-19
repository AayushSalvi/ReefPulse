from __future__ import annotations

import json
from pathlib import Path

import torch

from train import OceanVAE


def model_fn(model_dir: str) -> dict[str, object]:
    model_path = Path(model_dir) / "model_b.pt"
    stats_path = Path(model_dir) / "model_b_stats.json"

    stats = json.loads(stats_path.read_text(encoding="utf-8"))
    feature_names = stats["feature_names"]
    model = OceanVAE(input_dim=len(feature_names), latent_dim=int(stats.get("latent_dim", 4)))
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()
    return {"model": model, "stats": stats}


def input_fn(request_body: str, request_content_type: str) -> torch.Tensor:
    if request_content_type != "application/json":
        raise ValueError(f"Unsupported content type: {request_content_type}")

    payload = json.loads(request_body)
    values = payload["state_vector"]
    return torch.tensor([values], dtype=torch.float32)


def predict_fn(input_data: torch.Tensor, model_bundle: dict[str, object]) -> dict[str, object]:
    model = model_bundle["model"]
    with torch.no_grad():
        reconstruction, mu, logvar = model(input_data)
        per_feature_error = torch.square(input_data - reconstruction).squeeze(0)
        anomaly_score = float(per_feature_error.mean().item())

    return {
        "anomaly_score": anomaly_score,
        "reconstruction": reconstruction.squeeze(0).tolist(),
        "latent_mean": mu.squeeze(0).tolist(),
        "latent_logvar": logvar.squeeze(0).tolist(),
        "feature_names": model_bundle["stats"]["feature_names"],
        "threshold": model_bundle["stats"].get("baseline_threshold", 0.15),
        "driving_variables": per_feature_error.tolist(),
    }


def output_fn(prediction: dict[str, object], accept: str) -> tuple[str, str]:
    return json.dumps(prediction), "application/json"
