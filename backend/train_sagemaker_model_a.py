#!/usr/bin/env python3
"""
SageMaker training entry point for Model A.

Reads hyperparameters from /opt/ml/input/config/hyperparameters.json (SageMaker)
or from the command line for local tests.

Input channel ``training`` must contain ``train.npz`` and ``val.npz``.
Writes ``model_A_forecaster.pt`` to SM_MODEL_DIR (default /opt/ml/model).
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


def _load_hyperparameters() -> dict[str, str]:
    path = "/opt/ml/input/config/hyperparameters.json"
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
        return {str(k): str(v) for k, v in raw.items()}
    return {}


def _int(hps: dict[str, str], *keys: str, default: int) -> int:
    for key in keys:
        if key in hps:
            return int(hps[key])
    return default


def _float(hps: dict[str, str], *keys: str, default: float) -> float:
    for key in keys:
        if key in hps:
            return float(hps[key])
    return default


def _optional_int(hps: dict[str, str], *keys: str) -> int | None:
    for key in keys:
        if key not in hps:
            continue
        if hps[key] in ("", "none", "None"):
            continue
        v = int(hps[key])
        if v > 0:
            return v
    return None


def main() -> None:
    hps = _load_hyperparameters()

    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=None)
    parser.add_argument("--lr", type=float, default=None)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--max-train-samples", type=int, default=None)
    parser.add_argument("--max-val-samples", type=int, default=None)
    args, _unknown = parser.parse_known_args()

    epochs = args.epochs if args.epochs is not None else _int(hps, "epochs", default=20)
    batch_size = (
        args.batch_size
        if args.batch_size is not None
        else _int(hps, "batch-size", "batch_size", default=128)
    )
    lr = args.lr if args.lr is not None else _float(hps, "lr", default=0.001)
    seed = args.seed if args.seed is not None else _int(hps, "seed", default=42)
    max_train = args.max_train_samples
    if max_train is None:
        max_train = _optional_int(hps, "max-train-samples", "max_train_samples")
    max_val = args.max_val_samples
    if max_val is None:
        max_val = _optional_int(hps, "max-val-samples", "max_val_samples")

    channel = Path(os.environ.get("SM_CHANNEL_TRAINING", "/opt/ml/input/data/training"))
    train_npz = channel / "train.npz"
    val_npz = channel / "val.npz"
    out_dir = Path(os.environ.get("SM_MODEL_DIR", "/opt/ml/model"))
    out_dir.mkdir(parents=True, exist_ok=True)
    out_ckpt = out_dir / "model_A_forecaster.pt"

    if not train_npz.is_file() or not val_npz.is_file():
        raise FileNotFoundError(
            f"Expected {train_npz} and {val_npz} under input channel 'training'."
        )

    from app.ml.model_a.train import train_and_save

    huber_delta = _float(hps, "huber-delta", "huber_delta", default=1.0)
    es_patience = _int(hps, "early-stopping-patience", "early_stopping_patience", default=8)
    weight_decay = _float(hps, "weight-decay", "weight_decay", default=0.02)
    disable_sched = str(hps.get("disable-scheduler", hps.get("disable_scheduler", "false"))).lower() in (
        "1",
        "true",
        "yes",
    )

    metrics = train_and_save(
        train_npz,
        val_npz,
        out_ckpt,
        epochs=epochs,
        batch_size=batch_size,
        lr=lr,
        device=None,
        seed=seed,
        max_train_samples=max_train,
        max_val_samples=max_val,
        huber_delta=huber_delta,
        early_stopping_patience=es_patience,
        weight_decay=weight_decay,
        use_scheduler=not disable_sched,
    )
    print(f"saved checkpoint to {out_ckpt}", flush=True)
    print(f"metrics: {metrics}", flush=True)


if __name__ == "__main__":
    main()
