"""Per-station daily features and sliding windows for Model A (CalCOFI-derived)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import numpy as np
import pandas as pd

from app.ml.model_a.constants import (
    CHANNEL_NAMES,
    FEATURE_COLUMNS,
    HORIZON_DAYS,
    LOOKBACK_DAYS,
)


@dataclass
class WindowBundle:
    """Training arrays plus anchor dates for temporal splitting."""

    X: np.ndarray  # (N, LOOKBACK, C)
    Y: np.ndarray  # (N, HORIZON, C)
    anchor_dates: np.ndarray  # datetime64[D] or similar, length N


def load_features_table(path: str | Path) -> pd.DataFrame:
    """Load merged CalCOFI features (parquet or CSV)."""
    path = Path(path)
    if path.suffix.lower() == ".parquet":
        df = pd.read_parquet(path)
    else:
        df = pd.read_csv(path)
    missing = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns {missing}; expected {FEATURE_COLUMNS}")
    return df[list(FEATURE_COLUMNS)].copy()


def daily_per_station(df: pd.DataFrame) -> pd.DataFrame:
    """One row per (station_id, calendar day); depth samples averaged per day."""
    d = df.copy()
    d["date"] = pd.to_datetime(d["Date"], errors="coerce").dt.normalize()
    d = d.dropna(subset=["date"])
    numeric = list(CHANNEL_NAMES)
    g = (
        d.groupby(["station_id", "date"], as_index=False)
        .agg(
            {
                "lat": "mean",
                "lon": "mean",
                **{k: "mean" for k in numeric},
            }
        )
        .sort_values(["station_id", "date"])
    )
    return g


def interpolate_station_daily(g: pd.DataFrame, interp_limit_days: int = 14) -> pd.DataFrame:
    """Reindex to daily frequency and interpolate short gaps per station."""
    sid = g["station_id"].iloc[0]
    g = g.set_index("date").sort_index()
    idx = pd.date_range(g.index.min(), g.index.max(), freq="D")
    out = g.reindex(idx)
    out["station_id"] = sid
    for col in CHANNEL_NAMES:
        out[col] = out[col].interpolate(method="time", limit=interp_limit_days, limit_direction="both")
    out["lat"] = out["lat"].interpolate(limit_direction="both", limit=interp_limit_days)
    out["lon"] = out["lon"].interpolate(limit_direction="both", limit=interp_limit_days)
    out = out.dropna(subset=list(CHANNEL_NAMES))
    out.index.name = "date"
    out = out.reset_index()
    return out


def build_windows_from_daily(daily: pd.DataFrame) -> WindowBundle | None:
    """Slide (LOOKBACK, HORIZON) windows; daily must be single station, sorted by date."""
    need = LOOKBACK_DAYS + HORIZON_DAYS
    if len(daily) < need:
        return None
    daily = daily.sort_values("date").reset_index(drop=True)
    dates = pd.to_datetime(daily["date"]).values
    vals = daily[list(CHANNEL_NAMES)].to_numpy(dtype=np.float64)
    X_list: list[np.ndarray] = []
    Y_list: list[np.ndarray] = []
    anchors: list[np.datetime64] = []
    for t in range(0, len(daily) - need + 1):
        X_list.append(vals[t : t + LOOKBACK_DAYS].astype(np.float32))
        Y_list.append(vals[t + LOOKBACK_DAYS : t + need].astype(np.float32))
        anchors.append(np.datetime64(dates[t + LOOKBACK_DAYS], "D"))
    if not X_list:
        return None
    return WindowBundle(
        X=np.stack(X_list),
        Y=np.stack(Y_list),
        anchor_dates=np.array(anchors, dtype="datetime64[D]"),
    )


def build_all_station_windows(features_df: pd.DataFrame) -> WindowBundle:
    """Aggregate per-station daily series and concatenate all sliding windows."""
    daily_all = daily_per_station(features_df)
    bundles: list[WindowBundle] = []
    for sid in daily_all["station_id"].unique():
        sub = daily_all[daily_all["station_id"] == sid].copy()
        sub_i = interpolate_station_daily(sub)
        wb = build_windows_from_daily(sub_i)
        if wb is not None:
            bundles.append(wb)
    if not bundles:
        raise ValueError("No station had enough contiguous daily samples to build windows.")
    X = np.concatenate([b.X for b in bundles], axis=0)
    Y = np.concatenate([b.Y for b in bundles], axis=0)
    anchor = np.concatenate([b.anchor_dates for b in bundles], axis=0)
    order = np.argsort(anchor)
    return WindowBundle(X=X[order], Y=Y[order], anchor_dates=anchor[order])


def temporal_train_val_split(bundle: WindowBundle, val_fraction: float = 0.2) -> tuple[WindowBundle, WindowBundle]:
    """Last val_fraction of windows (by anchor date) for validation."""
    n = len(bundle.X)
    split = int(n * (1.0 - val_fraction))
    split = max(split, 1)
    split = min(split, n - 1)
    train = WindowBundle(
        X=bundle.X[:split],
        Y=bundle.Y[:split],
        anchor_dates=bundle.anchor_dates[:split],
    )
    val = WindowBundle(
        X=bundle.X[split:],
        Y=bundle.Y[split:],
        anchor_dates=bundle.anchor_dates[split:],
    )
    return train, val


def fit_scaler(X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Per-channel mean/std over (N, T) from training X only. Shapes (1,1,C)."""
    mean = X.mean(axis=(0, 1), keepdims=True, dtype=np.float64)
    std = X.std(axis=(0, 1), keepdims=True, dtype=np.float64)
    std = np.maximum(std, 1e-6)
    return mean.astype(np.float32), std.astype(np.float32)


def apply_scaler(X: np.ndarray, mean: np.ndarray, std: np.ndarray) -> np.ndarray:
    return ((X - mean) / std).astype(np.float32)


def save_npz(path: str | Path, bundle: WindowBundle) -> None:
    np.savez_compressed(
        path,
        X=bundle.X,
        Y=bundle.Y,
        anchor_dates=bundle.anchor_dates.astype("datetime64[ns]").astype(np.int64),
    )


def load_npz(path: str | Path) -> WindowBundle:
    z = np.load(path, allow_pickle=False)
    anchors = z["anchor_dates"].astype("datetime64[ns]")
    return WindowBundle(X=z["X"], Y=z["Y"], anchor_dates=anchors.astype("datetime64[D]"))
