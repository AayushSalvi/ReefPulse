"""Evaluate a Model A checkpoint on val.npz: RMSE/MAE per channel (physical units)."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

from app.ml.model_a.constants import CHANNEL_NAMES, HORIZON_DAYS, N_CHANNELS
from app.ml.model_a.feature_pipeline import apply_scaler


def run_eval(
    ckpt_path: Path,
    val_npz_path: Path,
    *,
    batch_size: int = 512,
    max_samples: int = 0,
) -> None:
    import torch

    from app.ml.model_a.model import PatchTSTMini

    ckpt = torch.load(ckpt_path, map_location="cpu")
    mean = ckpt["mean"].float().numpy().reshape(1, 1, N_CHANNELS)
    std = np.maximum(ckpt["std"].float().numpy().reshape(1, 1, N_CHANNELS), 1e-6)

    model = PatchTSTMini()
    model.load_state_dict(ckpt["state_dict"])
    model.eval()

    z = np.load(val_npz_path, allow_pickle=False)
    val_X = z["X"].astype(np.float32)
    val_Y = z["Y"].astype(np.float32)
    n = len(val_X)
    if max_samples and n > max_samples:
        rng = np.random.default_rng(42)
        idx = rng.choice(n, size=max_samples, replace=False)
        val_X, val_Y = val_X[idx], val_Y[idx]
        n = len(val_X)

    val_Xn = apply_scaler(val_X, mean, std)

    preds: list[np.ndarray] = []
    with torch.no_grad():
        for start in range(0, n, batch_size):
            end = min(start + batch_size, n)
            xb = torch.tensor(val_Xn[start:end], dtype=torch.float32)
            out = model(xb).numpy()
            preds.append(out)
    pred_n = np.concatenate(preds, axis=0)

    pred = pred_n * std + mean
    true = val_Y

    diff = pred - true
    rmse = np.sqrt(np.mean(diff**2, axis=(0, 1)))
    mae = np.mean(np.abs(diff), axis=(0, 1))

    print(f"evaluated {n} windows from {val_npz_path}")
    print("per-channel RMSE (all 14 days pooled), units = raw training units:")
    for i, name in enumerate(CHANNEL_NAMES):
        print(f"  {name:16s} RMSE={rmse[i]:.6g}  MAE={mae[i]:.6g}")

    per_day_rmse = np.sqrt(np.mean(diff**2, axis=(0, 2)))
    print("\nRMSE averaged across channels (per forecast day 1..14):")
    for d in range(HORIZON_DAYS):
        print(f"  day {d + 1:2d}: {per_day_rmse[d]:.6g}")

    mape = np.mean(np.abs(diff) / (np.abs(true) + 1e-6), axis=(0, 1)) * 100.0
    print("\nMAPE (%), rough (true near zero blows up; interpret carefully):")
    for i, name in enumerate(CHANNEL_NAMES):
        print(f"  {name:16s} MAPE={mape[i]:.2f}%")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ckpt", type=Path, required=True, help="Path to model_A_forecaster.pt")
    parser.add_argument("--val-npz", type=Path, required=True, help="Path to val.npz (X, Y)")
    parser.add_argument("--batch-size", type=int, default=512)
    parser.add_argument(
        "--max-samples",
        type=int,
        default=0,
        help="0 = use all val windows; else cap for speed",
    )
    args = parser.parse_args()
    run_eval(
        args.ckpt,
        args.val_npz,
        batch_size=args.batch_size,
        max_samples=args.max_samples,
    )


if __name__ == "__main__":
    main()
