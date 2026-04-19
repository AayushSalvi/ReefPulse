from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

FEATURE_PREFIXES = ("temperature_", "salinity_", "oxygen_", "chlorophyll_")


class OceanVAE(nn.Module):
    def __init__(self, input_dim: int, latent_dim: int = 4, hidden_dim: int = 32) -> None:
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
        )
        self.mu_layer = nn.Linear(hidden_dim // 2, latent_dim)
        self.logvar_layer = nn.Linear(hidden_dim // 2, latent_dim)
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, input_dim),
        )

    def encode(self, inputs: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        hidden = self.encoder(inputs)
        return self.mu_layer(hidden), self.logvar_layer(hidden)

    def reparameterize(self, mu: torch.Tensor, logvar: torch.Tensor) -> torch.Tensor:
        std = torch.exp(0.5 * logvar)
        epsilon = torch.randn_like(std)
        return mu + (epsilon * std)

    def decode(self, latent: torch.Tensor) -> torch.Tensor:
        return self.decoder(latent)

    def forward(self, inputs: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        mu, logvar = self.encode(inputs)
        latent = self.reparameterize(mu, logvar)
        reconstruction = self.decode(latent)
        return reconstruction, mu, logvar


def vae_loss(
    reconstruction: torch.Tensor,
    inputs: torch.Tensor,
    mu: torch.Tensor,
    logvar: torch.Tensor,
) -> torch.Tensor:
    reconstruction_loss = nn.functional.mse_loss(reconstruction, inputs, reduction="mean")
    kl_divergence = -0.5 * torch.mean(1 + logvar - mu.pow(2) - logvar.exp())
    return reconstruction_loss + kl_divergence


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train ReefPulse Model B VAE.")
    parser.add_argument("--train-parquet", help="Local path to the training parquet.")
    parser.add_argument("--val-parquet", help="Local path to the validation parquet.")
    parser.add_argument("--test-parquet", help="Optional local path to the test parquet.")
    parser.add_argument("--artifacts-dir", help="Directory for model weights and stats.")
    parser.add_argument("--reports-dir", help="Directory for scored parquet and report outputs.")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--latent-dim", type=int, default=4)
    parser.add_argument("--hidden-dim", type=int, default=32)
    parser.add_argument("--threshold-quantile", type=float, default=0.95)
    return parser.parse_args()


def resolve_input_path(explicit_path: str | None, *, channel_name: str, filename: str) -> Path | None:
    if explicit_path:
        return Path(explicit_path)

    channel_dir = os.getenv(f"SM_CHANNEL_{channel_name.upper()}")
    if not channel_dir:
        return None

    candidate = Path(channel_dir) / filename
    return candidate if candidate.exists() else None


def resolve_output_dir(explicit_path: str | None, env_var_name: str, default_path: str) -> Path:
    if explicit_path:
        return Path(explicit_path)

    env_value = os.getenv(env_var_name)
    if env_value:
        return Path(env_value)

    return Path(default_path)


def select_feature_columns(dataframe: pd.DataFrame) -> list[str]:
    return [column for column in dataframe.columns if column.startswith(FEATURE_PREFIXES)]


def make_loader(array: np.ndarray, *, batch_size: int, shuffle: bool) -> DataLoader:
    tensor = torch.tensor(array, dtype=torch.float32)
    return DataLoader(TensorDataset(tensor), batch_size=batch_size, shuffle=shuffle)


def fit_vae(
    model: OceanVAE,
    train_values: np.ndarray,
    val_values: np.ndarray,
    *,
    epochs: int,
    batch_size: int,
    learning_rate: float,
) -> dict[str, list[float]]:
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    train_loader = make_loader(train_values, batch_size=batch_size, shuffle=True)
    val_tensor = torch.tensor(val_values, dtype=torch.float32)

    history = {"train_loss": [], "val_loss": []}
    for _ in range(epochs):
        model.train()
        batch_losses: list[float] = []
        for (batch,) in train_loader:
            optimizer.zero_grad()
            reconstruction, mu, logvar = model(batch)
            loss = vae_loss(reconstruction, batch, mu, logvar)
            loss.backward()
            optimizer.step()
            batch_losses.append(float(loss.item()))

        model.eval()
        with torch.no_grad():
            reconstruction, mu, logvar = model(val_tensor)
            validation_loss = float(vae_loss(reconstruction, val_tensor, mu, logvar).item())

        history["train_loss"].append(sum(batch_losses) / max(1, len(batch_losses)))
        history["val_loss"].append(validation_loss)

    return history


def score_split(
    model: OceanVAE,
    dataframe: pd.DataFrame,
    *,
    feature_columns: list[str],
    batch_size: int,
) -> tuple[np.ndarray, np.ndarray]:
    values = dataframe[feature_columns].to_numpy(dtype=np.float32)
    loader = make_loader(values, batch_size=batch_size, shuffle=False)

    all_scores: list[np.ndarray] = []
    all_per_feature_errors: list[np.ndarray] = []
    model.eval()
    with torch.no_grad():
        for (batch,) in loader:
            reconstruction, _, _ = model(batch)
            per_feature_error = torch.square(batch - reconstruction)
            all_scores.append(per_feature_error.mean(dim=1).cpu().numpy())
            all_per_feature_errors.append(per_feature_error.cpu().numpy())

    scores = np.concatenate(all_scores) if all_scores else np.array([], dtype=np.float32)
    per_feature_errors = (
        np.concatenate(all_per_feature_errors, axis=0)
        if all_per_feature_errors
        else np.empty((0, len(feature_columns)), dtype=np.float32)
    )
    return scores, per_feature_errors


def build_predictions_frame(
    dataframe: pd.DataFrame,
    *,
    split_name: str,
    feature_columns: list[str],
    scores: np.ndarray,
    per_feature_errors: np.ndarray,
) -> pd.DataFrame:
    prediction_frame = dataframe.copy()
    prediction_frame["split"] = split_name
    prediction_frame["anomaly_score"] = scores
    for index, feature_name in enumerate(feature_columns):
        prediction_frame[f"{feature_name}_recon_error"] = per_feature_errors[:, index]
    return prediction_frame


def summarize_scores(scores: np.ndarray) -> dict[str, float]:
    if len(scores) == 0:
        return {"count": 0}

    return {
        "count": int(len(scores)),
        "min": float(np.min(scores)),
        "p50": float(np.quantile(scores, 0.50)),
        "p90": float(np.quantile(scores, 0.90)),
        "p95": float(np.quantile(scores, 0.95)),
        "max": float(np.max(scores)),
        "mean": float(np.mean(scores)),
    }


def main() -> None:
    args = parse_args()

    train_path = resolve_input_path(args.train_parquet, channel_name="train", filename="train.parquet")
    val_path = resolve_input_path(args.val_parquet, channel_name="validation", filename="val.parquet")
    test_path = resolve_input_path(args.test_parquet, channel_name="test", filename="test.parquet")
    if train_path is None or val_path is None:
        raise FileNotFoundError("Training and validation parquet paths are required.")

    artifacts_dir = resolve_output_dir(args.artifacts_dir, "SM_MODEL_DIR", "artifacts")
    reports_dir = resolve_output_dir(args.reports_dir, "SM_OUTPUT_DATA_DIR", "artifacts")
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    train_df = pd.read_parquet(train_path)
    val_df = pd.read_parquet(val_path)
    test_df = pd.read_parquet(test_path) if test_path and test_path.exists() else None

    feature_columns = select_feature_columns(train_df)
    if not feature_columns:
        raise ValueError("No feature columns were found for Model B training.")

    x_train = train_df[feature_columns].to_numpy(dtype=np.float32)
    x_val = val_df[feature_columns].to_numpy(dtype=np.float32)

    model = OceanVAE(
        input_dim=len(feature_columns),
        latent_dim=args.latent_dim,
        hidden_dim=args.hidden_dim,
    )
    history = fit_vae(
        model,
        x_train,
        x_val,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
    )

    val_scores, val_per_feature_errors = score_split(
        model,
        val_df,
        feature_columns=feature_columns,
        batch_size=args.batch_size,
    )
    threshold = float(np.quantile(val_scores, args.threshold_quantile))

    prediction_frames = [
        build_predictions_frame(
            val_df,
            split_name="validation",
            feature_columns=feature_columns,
            scores=val_scores,
            per_feature_errors=val_per_feature_errors,
        )
    ]
    report_payload: dict[str, object] = {
        "feature_names": feature_columns,
        "train_rows": int(len(train_df)),
        "validation_rows": int(len(val_df)),
        "test_rows": int(len(test_df)) if test_df is not None else 0,
        "latent_dim": args.latent_dim,
        "hidden_dim": args.hidden_dim,
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "threshold_quantile": args.threshold_quantile,
        "threshold": threshold,
        "train_loss_final": float(history["train_loss"][-1]),
        "val_loss_final": float(history["val_loss"][-1]),
        "validation_score_summary": summarize_scores(val_scores),
        "train_source": str(train_path),
        "validation_source": str(val_path),
        "test_source": str(test_path) if test_path else None,
    }

    if test_df is not None and not test_df.empty:
        test_scores, test_per_feature_errors = score_split(
            model,
            test_df,
            feature_columns=feature_columns,
            batch_size=args.batch_size,
        )
        prediction_frames.append(
            build_predictions_frame(
                test_df,
                split_name="test",
                feature_columns=feature_columns,
                scores=test_scores,
                per_feature_errors=test_per_feature_errors,
            )
        )
        report_payload["test_score_summary"] = summarize_scores(test_scores)

    predictions_df = pd.concat(prediction_frames, ignore_index=True)

    torch.save(model.state_dict(), artifacts_dir / "model_b.pt")
    stats_payload = {
        "feature_names": feature_columns,
        "feature_means": train_df[feature_columns].mean().tolist(),
        "feature_stds": train_df[feature_columns].std().replace(0, 1.0).fillna(1.0).tolist(),
        "latent_dim": args.latent_dim,
        "hidden_dim": args.hidden_dim,
        "threshold": threshold,
        "baseline_threshold": threshold,
        "training_history": history,
    }
    (artifacts_dir / "model_b_stats.json").write_text(json.dumps(stats_payload, indent=2), encoding="utf-8")
    (reports_dir / "vae_report.json").write_text(json.dumps(report_payload, indent=2), encoding="utf-8")
    predictions_df.to_parquet(reports_dir / "vae_predictions.parquet", index=False)

    print(f"Saved model weights to {artifacts_dir / 'model_b.pt'}")
    print(f"Saved model stats to {artifacts_dir / 'model_b_stats.json'}")
    print(f"Saved VAE report to {reports_dir / 'vae_report.json'}")
    print(f"Saved scored predictions to {reports_dir / 'vae_predictions.parquet'}")


if __name__ == "__main__":
    main()
