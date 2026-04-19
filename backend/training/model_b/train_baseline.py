from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

from app.ml.baselines import train_isolation_forest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train and evaluate the ReefPulse Model B Isolation Forest baseline.")
    parser.add_argument("--train-parquet", required=True)
    parser.add_argument("--val-parquet", required=True)
    parser.add_argument("--test-parquet", required=True)
    parser.add_argument("--artifacts-dir", default="artifacts/baseline")
    parser.add_argument("--contamination", type=float, default=0.05)
    parser.add_argument("--threshold-quantile", type=float, default=0.95)
    parser.add_argument("--random-state", type=int, default=42)
    return parser.parse_args()


def get_feature_columns(frame: pd.DataFrame) -> list[str]:
    return [
        column
        for column in frame.columns
        if column.endswith("m") and any(prefix in column for prefix in ("temperature_", "salinity_", "oxygen_", "chlorophyll_"))
    ]


def prepare_scored_frame(
    frame: pd.DataFrame,
    *,
    feature_columns: list[str],
    model,
    threshold: float,
    split_name: str,
    blob_proxy_label: int,
) -> pd.DataFrame:
    scored = frame.copy()
    values = scored[feature_columns].to_numpy()
    scored["anomaly_score"] = -model.score_samples(values)
    scored["threshold"] = threshold
    scored["is_anomaly"] = scored["anomaly_score"] > threshold
    scored["blob_proxy_label"] = blob_proxy_label
    scored["split"] = split_name
    return scored


def score_summary(frame: pd.DataFrame) -> dict[str, float | int]:
    return {
        "row_count": int(len(frame)),
        "mean_score": float(frame["anomaly_score"].mean()),
        "median_score": float(frame["anomaly_score"].median()),
        "max_score": float(frame["anomaly_score"].max()),
        "anomaly_rate": float(frame["is_anomaly"].mean()),
    }


def plot_daily_scores(scored: pd.DataFrame, *, threshold: float, output_path: Path) -> None:
    plot_frame = scored.copy()
    plot_frame["date"] = pd.to_datetime(plot_frame["date"])
    daily = (
        plot_frame.groupby("date", as_index=False)
        .agg(
            anomaly_score=("anomaly_score", "mean"),
            blob_proxy_label=("blob_proxy_label", "max"),
        )
        .sort_values("date")
    )

    fig, ax = plt.subplots(figsize=(14, 6))
    ax.plot(daily["date"], daily["anomaly_score"], color="#0B6E4F", linewidth=1.8, label="Daily mean anomaly score")
    ax.axhline(threshold, color="#B22222", linestyle="--", linewidth=1.4, label=f"Threshold ({threshold:.3f})")
    ax.axvspan(pd.Timestamp("2014-01-01"), pd.Timestamp("2016-12-31"), color="#F4A6A6", alpha=0.28, label="Blob proxy window")
    ax.set_title("Model B Baseline: Isolation Forest Anomaly Score Over Time")
    ax.set_xlabel("Date")
    ax.set_ylabel("Anomaly score")
    ax.legend(loc="upper right")
    ax.grid(alpha=0.2)
    fig.tight_layout()
    fig.savefig(output_path, dpi=200)
    plt.close(fig)


def main() -> None:
    args = parse_args()
    artifacts_dir = Path(args.artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    train_df = pd.read_parquet(args.train_parquet)
    val_df = pd.read_parquet(args.val_parquet)
    test_df = pd.read_parquet(args.test_parquet)

    feature_columns = get_feature_columns(train_df)
    if not feature_columns:
        raise ValueError("No Model B feature columns found in the parquet inputs.")

    x_train = train_df[feature_columns].to_numpy()
    model = train_isolation_forest(
        x_train,
        contamination=args.contamination,
        random_state=args.random_state,
    )

    val_scores_raw = -model.score_samples(val_df[feature_columns].to_numpy())
    threshold = float(pd.Series(val_scores_raw).quantile(args.threshold_quantile))

    train_scored = prepare_scored_frame(
        train_df,
        feature_columns=feature_columns,
        model=model,
        threshold=threshold,
        split_name="train",
        blob_proxy_label=0,
    )
    val_scored = prepare_scored_frame(
        val_df,
        feature_columns=feature_columns,
        model=model,
        threshold=threshold,
        split_name="val",
        blob_proxy_label=0,
    )
    test_scored = prepare_scored_frame(
        test_df,
        feature_columns=feature_columns,
        model=model,
        threshold=threshold,
        split_name="test",
        blob_proxy_label=1,
    )

    combined = pd.concat([train_scored, val_scored, test_scored], ignore_index=True)
    evaluation_frame = pd.concat([val_scored, test_scored], ignore_index=True)

    roc_auc = float(roc_auc_score(evaluation_frame["blob_proxy_label"], evaluation_frame["anomaly_score"]))
    average_precision = float(
        average_precision_score(evaluation_frame["blob_proxy_label"], evaluation_frame["anomaly_score"])
    )

    predictions_path = artifacts_dir / "baseline_predictions.parquet"
    combined.to_parquet(predictions_path, index=False)

    plot_path = artifacts_dir / "baseline_anomaly_timeseries.png"
    plot_daily_scores(combined, threshold=threshold, output_path=plot_path)

    top_test_days = (
        test_scored.assign(date=pd.to_datetime(test_scored["date"]))
        .groupby("date", as_index=False)["anomaly_score"]
        .mean()
        .sort_values("anomaly_score", ascending=False)
        .head(10)
    )

    report = {
        "model": "IsolationForest",
        "feature_columns": feature_columns,
        "threshold": threshold,
        "threshold_quantile": args.threshold_quantile,
        "contamination": args.contamination,
        "random_state": args.random_state,
        "roc_auc_blob_proxy": roc_auc,
        "average_precision_blob_proxy": average_precision,
        "split_summaries": {
            "train": score_summary(train_scored),
            "val": score_summary(val_scored),
            "test": score_summary(test_scored),
        },
        "top_test_days": [
            {"date": date.strftime("%Y-%m-%d"), "mean_anomaly_score": float(score)}
            for date, score in zip(top_test_days["date"], top_test_days["anomaly_score"])
        ],
        "artifacts": {
            "predictions_parquet": str(predictions_path),
            "timeseries_plot": str(plot_path),
        },
    }

    report_path = artifacts_dir / "baseline_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"Saved predictions parquet: {predictions_path}")
    print(f"Saved baseline plot: {plot_path}")
    print(f"Saved baseline report: {report_path}")
    print(f"ROC AUC (Blob proxy): {roc_auc:.4f}")
    print(f"Average precision (Blob proxy): {average_precision:.4f}")


if __name__ == "__main__":
    main()
