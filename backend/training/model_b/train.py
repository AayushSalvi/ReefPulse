from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from app.ml.baselines import score_isolation_forest, train_isolation_forest


class OceanVAE(nn.Module):
    def __init__(self, input_dim: int = 16, latent_dim: int = 4, hidden_dim: int = 32) -> None:
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


def make_loader(array: np.ndarray, batch_size: int) -> DataLoader:
    tensor = torch.tensor(array, dtype=torch.float32)
    return DataLoader(TensorDataset(tensor), batch_size=batch_size, shuffle=True)


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
    train_loader = make_loader(train_values, batch_size=batch_size)
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train ReefPulse Model B VAE.")
    parser.add_argument("--train-parquet", required=True)
    parser.add_argument("--val-parquet", required=True)
    parser.add_argument("--artifacts-dir", default="artifacts")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--latent-dim", type=int, default=4)
    parser.add_argument("--hidden-dim", type=int, default=32)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    artifacts_dir = Path(args.artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    train_df = pd.read_parquet(args.train_parquet)
    val_df = pd.read_parquet(args.val_parquet)
    feature_columns = [
        column
        for column in train_df.columns
        if column.endswith("m") and any(prefix in column for prefix in ("temperature_", "salinity_", "oxygen_", "chlorophyll_"))
    ]

    x_train = train_df[feature_columns].to_numpy(dtype=np.float32)
    x_val = val_df[feature_columns].to_numpy(dtype=np.float32)

    baseline = train_isolation_forest(x_train)
    baseline_scores = score_isolation_forest(baseline, x_val)

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

    torch.save(model.state_dict(), artifacts_dir / "model_b.pt")
    stats = {
        "feature_names": feature_columns,
        "feature_means": train_df[feature_columns].mean().tolist(),
        "feature_stds": train_df[feature_columns].std().replace(0, 1.0).fillna(1.0).tolist(),
        "latent_dim": args.latent_dim,
        "shrink_factor": 0.15,
        "baseline_threshold": baseline_scores.threshold,
        "training_history": history,
    }
    (artifacts_dir / "model_b_stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
