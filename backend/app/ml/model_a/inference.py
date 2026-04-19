"""Load Model A checkpoint; 14-day forecast with MC-dropout uncertainty bands."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

from app.ml.model_a.constants import CHANNEL_NAMES, HORIZON_DAYS, LOOKBACK_DAYS, N_CHANNELS


class ModelAForecaster:
    """Monte Carlo dropout: multiple forward passes with dropout enabled."""

    def __init__(self, checkpoint_path: str | Path, mc_samples: int = 30) -> None:
        import torch

        from app.ml.model_a.model import PatchTSTMini

        self._torch = torch
        self.checkpoint_path = Path(checkpoint_path)
        self.mc_samples = max(1, mc_samples)
        ckpt = torch.load(self.checkpoint_path, map_location="cpu")
        self.mean = ckpt["mean"].float().view(1, 1, N_CHANNELS)
        self.std = ckpt["std"].float().view(1, 1, N_CHANNELS).clamp_min(1e-6)
        self.model = PatchTSTMini()
        self.model.load_state_dict(ckpt["state_dict"])
        self.model.eval()

    def _normalize(self, x: np.ndarray) -> Any:
        torch = self._torch
        t = torch.tensor(x, dtype=torch.float32).view(1, LOOKBACK_DAYS, N_CHANNELS)
        return (t - self.mean) / self.std

    def _denormalize(self, t: Any) -> np.ndarray:
        torch = self._torch
        return (t * self.std + self.mean).squeeze(0).numpy()

    def predict(
        self,
        past_30d: np.ndarray,
        *,
        quantiles: tuple[float, float] = (0.1, 0.9),
    ) -> dict[str, Any]:
        """
        past_30d: shape (30, 4) in physical units, columns order CHANNEL_NAMES.
        Returns mean and uncertainty bands in physical units (14, 4).
        """
        torch = self._torch
        if past_30d.shape != (LOOKBACK_DAYS, N_CHANNELS):
            raise ValueError(f"past_30d must be ({LOOKBACK_DAYS}, {N_CHANNELS}), got {past_30d.shape}")

        xn = self._normalize(past_30d)
        preds: list[np.ndarray] = []
        self.model.train()
        with torch.no_grad():
            for _ in range(self.mc_samples):
                out = self.model(xn)
                preds.append(self._denormalize(out))
        self.model.eval()

        stack = np.stack(preds, axis=0)
        mean = stack.mean(axis=0)
        q_lo, q_hi = quantiles
        p_lo = np.quantile(stack, q_lo, axis=0)
        p_hi = np.quantile(stack, q_hi, axis=0)

        return {
            "forecast_mean": mean.tolist(),
            "forecast_p10": p_lo.tolist(),
            "forecast_p90": p_hi.tolist(),
            "horizon_days": HORIZON_DAYS,
            "channels": list(CHANNEL_NAMES),
        }


def load_forecaster(checkpoint_path: str | Path | None, mc_samples: int = 30) -> ModelAForecaster | None:
    if not checkpoint_path:
        return None
    path = Path(checkpoint_path)
    if not path.is_file():
        return None
    try:
        return ModelAForecaster(path, mc_samples=mc_samples)
    except Exception:
        return None
