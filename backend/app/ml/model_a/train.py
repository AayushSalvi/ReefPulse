"""Train Model A (PatchTST-mini) on windowed NPZ; save checkpoint + scaler."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from app.ml.model_a.constants import CHANNEL_NAMES, HORIZON_DAYS, LOOKBACK_DAYS
from app.ml.model_a.feature_pipeline import apply_scaler, fit_scaler
from app.ml.model_a.model import PatchTSTMini


def _load_npz(path: Path) -> tuple[np.ndarray, np.ndarray]:
    z = np.load(path, allow_pickle=False)
    return z["X"], z["Y"]


def train_and_save(
    train_npz: Path,
    val_npz: Path,
    out_ckpt: Path,
    epochs: int = 25,
    batch_size: int = 128,
    lr: float = 1e-3,
    device: str | None = None,
    seed: int = 42,
    max_train_samples: int | None = None,
    max_val_samples: int | None = None,
) -> dict[str, float]:
    torch.manual_seed(seed)
    np.random.seed(seed)

    train_X, train_Y = _load_npz(train_npz)
    val_X, val_Y = _load_npz(val_npz)

    rng = np.random.default_rng(seed)
    if max_train_samples is not None and len(train_X) > max_train_samples:
        idx = rng.choice(len(train_X), size=max_train_samples, replace=False)
        train_X, train_Y = train_X[idx], train_Y[idx]
    if max_val_samples is not None and len(val_X) > max_val_samples:
        idx_v = rng.choice(len(val_X), size=max_val_samples, replace=False)
        val_X, val_Y = val_X[idx_v], val_Y[idx_v]

    print(
        f"training on {len(train_X)} train windows, {len(val_X)} val windows",
        flush=True,
    )

    mean, std = fit_scaler(train_X)
    train_Xn = apply_scaler(train_X, mean, std)
    train_Yn = apply_scaler(train_Y, mean, std)
    val_Xn = apply_scaler(val_X, mean, std)
    val_Yn = apply_scaler(val_Y, mean, std)

    dev = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
    model = PatchTSTMini().to(dev)
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    loss_fn = nn.MSELoss()

    train_loader = DataLoader(
        TensorDataset(
            torch.tensor(train_Xn, dtype=torch.float32),
            torch.tensor(train_Yn, dtype=torch.float32),
        ),
        batch_size=batch_size,
        shuffle=True,
    )
    val_loader = DataLoader(
        TensorDataset(
            torch.tensor(val_Xn, dtype=torch.float32),
            torch.tensor(val_Yn, dtype=torch.float32),
        ),
        batch_size=batch_size,
        shuffle=False,
    )

    best_val = float("inf")
    best_state: dict[str, torch.Tensor] | None = None

    def rmse(a: torch.Tensor, b: torch.Tensor) -> torch.Tensor:
        return torch.sqrt(torch.mean((a - b) ** 2))

    for epoch in range(1, epochs + 1):
        model.train()
        tr_loss = 0.0
        for xb, yb in train_loader:
            xb, yb = xb.to(dev), yb.to(dev)
            opt.zero_grad()
            pred = model(xb)
            loss = loss_fn(pred, yb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            tr_loss += loss.item() * xb.size(0)
        tr_loss /= len(train_loader.dataset)

        model.eval()
        va_loss = 0.0
        va_rmse = 0.0
        with torch.no_grad():
            for xb, yb in val_loader:
                xb, yb = xb.to(dev), yb.to(dev)
                pred = model(xb)
                va_loss += loss_fn(pred, yb).item() * xb.size(0)
                va_rmse += rmse(pred, yb).item() * xb.size(0)
        va_loss /= len(val_loader.dataset)
        va_rmse /= len(val_loader.dataset)

        if va_loss < best_val:
            best_val = va_loss
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

        if epoch == 1 or epoch % 5 == 0 or epoch == epochs:
            print(
                f"epoch {epoch:02d}: train_mse={tr_loss:.6f} val_mse={va_loss:.6f} val_rmse_scalar={va_rmse:.6f}"
            )

    if best_state is not None:
        model.load_state_dict(best_state)

    out_ckpt.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "arch": "patchtst_mini_v1",
            "state_dict": model.state_dict(),
            "mean": torch.tensor(mean.squeeze(0).squeeze(0)),
            "std": torch.tensor(std.squeeze(0).squeeze(0)),
            "meta": {
                "lookback": LOOKBACK_DAYS,
                "horizon": HORIZON_DAYS,
                "channels": list(CHANNEL_NAMES),
            },
        },
        out_ckpt,
    )
    return {"best_val_mse": float(best_val)}


def main() -> None:
    p = argparse.ArgumentParser(description="Train Model A from train/val NPZ windows.")
    p.add_argument("--train-npz", type=Path, required=True)
    p.add_argument("--val-npz", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True, help="Output .pt checkpoint path")
    p.add_argument("--epochs", type=int, default=25)
    p.add_argument("--batch-size", type=int, default=128)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--device", type=str, default=None)
    p.add_argument(
        "--max-train-samples",
        type=int,
        default=None,
        help="Random subset cap for faster CPU runs (full fit uses all).",
    )
    p.add_argument(
        "--max-val-samples",
        type=int,
        default=None,
        help="Random subset cap for validation.",
    )
    args = p.parse_args()
    metrics = train_and_save(
        args.train_npz,
        args.val_npz,
        args.out,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        device=args.device,
        max_train_samples=args.max_train_samples,
        max_val_samples=args.max_val_samples,
    )
    print("saved:", args.out)
    print("metrics:", metrics)


if __name__ == "__main__":
    main()
