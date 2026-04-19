"""Patch-style time transformer for multivariate 30-day -> 14-day forecasting."""

from __future__ import annotations

import torch
import torch.nn as nn

from app.ml.model_a.constants import HORIZON_DAYS, LOOKBACK_DAYS, N_CHANNELS


class PatchTSTMini(nn.Module):
    """Patch embedding over time + TransformerEncoder + head (PatchTST-style)."""

    def __init__(
        self,
        n_vars: int = N_CHANNELS,
        lookback: int = LOOKBACK_DAYS,
        horizon: int = HORIZON_DAYS,
        patch_len: int = 6,
        stride: int = 3,
        d_model: int = 128,
        nhead: int = 4,
        num_layers: int = 3,
        dim_ff: int = 256,
        dropout: float = 0.22,
    ) -> None:
        super().__init__()
        self.n_vars = n_vars
        self.lookback = lookback
        self.horizon = horizon
        self.patch_len = patch_len
        self.stride = stride

        last_start = lookback - patch_len
        if last_start < 0:
            raise ValueError("patch_len too large for lookback")
        self.n_patches = (last_start // stride) + 1

        patch_dim = patch_len * n_vars
        self.patch_proj = nn.Linear(patch_dim, d_model)
        self.pos = nn.Parameter(torch.zeros(1, self.n_patches, d_model))
        nn.init.trunc_normal_(self.pos, std=0.02)

        enc_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_ff,
            dropout=dropout,
            batch_first=True,
            activation="gelu",
            norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(enc_layer, num_layers=num_layers)
        self.dropout = nn.Dropout(dropout)

        self.head = nn.Sequential(
            nn.LayerNorm(d_model * self.n_patches),
            nn.Linear(d_model * self.n_patches, 512),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(512, horizon * n_vars),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: (B, L, C) normalized."""
        b, L, C = x.shape
        patches: list[torch.Tensor] = []
        for start in range(0, L - self.patch_len + 1, self.stride):
            p = x[:, start : start + self.patch_len, :].reshape(b, -1)
            patches.append(p)
        p = torch.stack(patches, dim=1)
        h = self.patch_proj(p) + self.pos
        h = self.encoder(h)
        h = self.dropout(h)
        h = h.reshape(b, -1)
        return self.head(h).reshape(b, self.horizon, self.n_vars)
