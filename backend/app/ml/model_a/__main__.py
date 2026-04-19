"""CLI: build windows from features table, or train from NPZ."""

from __future__ import annotations

import argparse
from pathlib import Path

from app.ml.model_a.feature_pipeline import (
    build_all_station_windows,
    load_features_table,
    save_npz,
    temporal_train_val_split,
)
from app.ml.model_a.eval_checkpoint import run_eval
from app.ml.model_a.train import train_and_save


def cmd_build_windows(args: argparse.Namespace) -> None:
    df = load_features_table(Path(args.features))
    bundle = build_all_station_windows(df)
    train_b, val_b = temporal_train_val_split(bundle, val_fraction=args.val_fraction)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    save_npz(out_dir / "train.npz", train_b)
    save_npz(out_dir / "val.npz", val_b)
    print("train windows:", train_b.X.shape, "val:", val_b.X.shape)
    print("wrote:", out_dir / "train.npz", out_dir / "val.npz")


def cmd_eval(args: argparse.Namespace) -> None:
    run_eval(
        Path(args.ckpt),
        Path(args.val_npz),
        batch_size=args.batch_size,
        max_samples=args.max_samples,
    )


def cmd_train(args: argparse.Namespace) -> None:
    metrics = train_and_save(
        Path(args.train_npz),
        Path(args.val_npz),
        Path(args.out),
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        device=args.device,
        max_train_samples=args.max_train_samples,
        max_val_samples=args.max_val_samples,
        huber_delta=args.huber_delta,
        early_stopping_patience=args.early_stopping_patience,
        weight_decay=args.weight_decay,
        use_scheduler=not args.no_scheduler,
    )
    print("saved:", args.out)
    print("metrics:", metrics)


def main() -> None:
    root = argparse.ArgumentParser(prog="python -m app.ml.model_a")
    sub = root.add_subparsers(dest="cmd", required=True)

    p_build = sub.add_parser("build-windows", help="Build per-station NPZ from features parquet/CSV")
    p_build.add_argument("--features", required=True, help="Path to features parquet or CSV")
    p_build.add_argument("--out-dir", required=True, help="Directory for train.npz and val.npz")
    p_build.add_argument("--val-fraction", type=float, default=0.2)
    p_build.set_defaults(func=cmd_build_windows)

    p_train = sub.add_parser("train", help="Train from train.npz and val.npz")
    p_train.add_argument("--train-npz", type=Path, required=True)
    p_train.add_argument("--val-npz", type=Path, required=True)
    p_train.add_argument("--out", type=Path, required=True)
    p_train.add_argument("--epochs", type=int, default=25)
    p_train.add_argument("--batch-size", type=int, default=128)
    p_train.add_argument("--lr", type=float, default=1e-3)
    p_train.add_argument("--device", type=str, default=None)
    p_train.add_argument("--max-train-samples", type=int, default=None)
    p_train.add_argument("--max-val-samples", type=int, default=None)
    p_train.add_argument("--huber-delta", type=float, default=1.0)
    p_train.add_argument("--early-stopping-patience", type=int, default=8)
    p_train.add_argument("--no-scheduler", action="store_true")
    p_train.add_argument("--weight-decay", type=float, default=0.02)
    p_train.set_defaults(func=cmd_train)

    p_eval = sub.add_parser("eval", help="RMSE/MAE on val.npz (physical units)")
    p_eval.add_argument("--ckpt", type=Path, required=True)
    p_eval.add_argument("--val-npz", type=Path, required=True)
    p_eval.add_argument("--batch-size", type=int, default=512)
    p_eval.add_argument("--max-samples", type=int, default=0)
    p_eval.set_defaults(func=cmd_eval)

    args = root.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
