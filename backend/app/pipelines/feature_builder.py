from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
from io import BytesIO
import json
from pathlib import Path

import pandas as pd
from sklearn.preprocessing import StandardScaler

from app.clients.aws_clients import get_s3_client
from app.core.config import settings

TARGET_DEPTHS = (10, 50, 100, 200)
MODEL_B_FEATURES = ("temperature", "salinity", "oxygen", "chlorophyll")
RAW_BOTTLE_KEY = "raw/calcofi/bottle_db.csv"
RAW_CAST_KEY = "raw/calcofi/cast_db.csv"
PROCESSED_MODEL_B_KEY = "processed/model_b_features.parquet"
PROCESSED_MODEL_B_SPLIT_KEYS = {
    "train": "processed/model_b/train.parquet",
    "val": "processed/model_b/val.parquet",
    "test": "processed/model_b/test.parquet",
}
PROCESSED_MODEL_B_STATS_KEY = "processed/model_b/stats.json"

CALCOFI_BOTTLE_USECOLS = [
    "Cst_Cnt",
    "Depthm",
    "T_degC",
    "Salnty",
    "O2ml_L",
    "ChlorA",
]
CALCOFI_CAST_USECOLS = [
    "Cst_Cnt",
    "Date",
    "Sta_ID",
    "Lat_Dec",
    "Lon_Dec",
]


@dataclass
class CalCOFIColumnConfig:
    join_column: str = "Cst_Cnt"
    date_column: str = "Date"
    station_column: str = "Sta_ID"
    latitude_column: str = "Lat_Dec"
    longitude_column: str = "Lon_Dec"
    depth_column: str = "Depthm"
    feature_columns: dict[str, str] | None = None

    def __post_init__(self) -> None:
        if self.feature_columns is None:
            self.feature_columns = {
                "temperature": "T_degC",
                "salinity": "Salnty",
                "oxygen": "O2ml_L",
                "chlorophyll": "ChlorA",
            }


@dataclass
class PersistedFeatureArtifacts:
    combined_local_path: Path
    split_local_paths: dict[str, Path]
    stats_local_path: Path
    combined_s3_uri: str | None = None
    split_s3_uris: dict[str, str] | None = None
    stats_s3_uri: str | None = None


def load_csv_from_s3(
    *,
    bucket: str,
    key: str,
    encoding: str = "latin1",
    usecols: list[str] | None = None,
) -> pd.DataFrame:
    response = get_s3_client().get_object(Bucket=bucket, Key=key)
    return pd.read_csv(response["Body"], encoding=encoding, usecols=usecols)


def load_csv_from_local(
    local_path: str | Path,
    *,
    encoding: str = "latin1",
    usecols: list[str] | None = None,
) -> pd.DataFrame:
    return pd.read_csv(local_path, encoding=encoding, usecols=usecols)


def load_calcofi_inputs(
    *,
    bottle_local_path: str | Path | None = None,
    cast_local_path: str | Path | None = None,
    bucket: str = settings.s3_bucket,
    bottle_key: str = RAW_BOTTLE_KEY,
    cast_key: str = RAW_CAST_KEY,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    if bottle_local_path is not None:
        bottle_df = load_csv_from_local(bottle_local_path, usecols=CALCOFI_BOTTLE_USECOLS)
    else:
        bottle_df = load_csv_from_s3(bucket=bucket, key=bottle_key, usecols=CALCOFI_BOTTLE_USECOLS)

    if cast_local_path is not None:
        cast_df = load_csv_from_local(cast_local_path, usecols=CALCOFI_CAST_USECOLS)
    else:
        cast_df = load_csv_from_s3(bucket=bucket, key=cast_key, usecols=CALCOFI_CAST_USECOLS)

    return bottle_df, cast_df


def build_model_b_feature_matrix(
    bottle_df: pd.DataFrame,
    cast_df: pd.DataFrame,
    *,
    config: CalCOFIColumnConfig | None = None,
    target_depths: tuple[int, ...] = TARGET_DEPTHS,
) -> pd.DataFrame:
    resolved_config = config or CalCOFIColumnConfig()
    feature_columns = resolved_config.feature_columns or {}

    bottle = bottle_df.copy()
    cast = cast_df.copy()

    bottle[resolved_config.join_column] = pd.to_numeric(bottle[resolved_config.join_column], errors="coerce")
    cast[resolved_config.join_column] = pd.to_numeric(cast[resolved_config.join_column], errors="coerce")
    bottle[resolved_config.depth_column] = pd.to_numeric(bottle[resolved_config.depth_column], errors="coerce")
    cast[resolved_config.date_column] = pd.to_datetime(cast[resolved_config.date_column], errors="coerce")
    cast[resolved_config.latitude_column] = pd.to_numeric(cast[resolved_config.latitude_column], errors="coerce")
    cast[resolved_config.longitude_column] = pd.to_numeric(cast[resolved_config.longitude_column], errors="coerce")

    for source_column in feature_columns.values():
        bottle[source_column] = pd.to_numeric(bottle[source_column], errors="coerce")

    bottle = bottle.dropna(subset=[resolved_config.join_column, resolved_config.depth_column])
    cast = cast.dropna(subset=[resolved_config.join_column, resolved_config.date_column])

    merged = bottle.merge(
        cast,
        on=resolved_config.join_column,
        how="inner",
    )
    merged = merged.loc[merged[resolved_config.date_column].dt.year >= 1993].copy()
    merged = merged.loc[merged[resolved_config.depth_column].isin(target_depths)].copy()

    index_columns = [
        resolved_config.join_column,
        resolved_config.station_column,
        resolved_config.date_column,
        resolved_config.latitude_column,
        resolved_config.longitude_column,
        resolved_config.depth_column,
    ]
    aggregate_columns = list(feature_columns.values())
    merged = (
        merged[index_columns + aggregate_columns]
        .groupby(index_columns, as_index=False)
        .mean(numeric_only=True)
    )

    wide_frames: list[pd.DataFrame] = []
    wide_index_columns = [
        resolved_config.join_column,
        resolved_config.station_column,
        resolved_config.date_column,
        resolved_config.latitude_column,
        resolved_config.longitude_column,
    ]
    for feature_name, source_column in feature_columns.items():
        pivoted = merged.pivot_table(
            index=wide_index_columns,
            columns=resolved_config.depth_column,
            values=source_column,
            aggfunc="mean",
        )
        pivoted.columns = [f"{feature_name}_{int(depth)}m" for depth in pivoted.columns]
        wide_frames.append(pivoted)

    combined = pd.concat(wide_frames, axis=1).reset_index()
    combined = combined.rename(
        columns={
            resolved_config.join_column: "cast_count",
            resolved_config.station_column: "station_id",
            resolved_config.date_column: "date",
            resolved_config.latitude_column: "latitude",
            resolved_config.longitude_column: "longitude",
        }
    )

    expected_feature_columns = [f"{feature}_{depth}m" for feature in MODEL_B_FEATURES for depth in target_depths]
    for column in expected_feature_columns:
        if column not in combined.columns:
            combined[column] = pd.NA

    ordered_columns = [
        "cast_count",
        "station_id",
        "date",
        "latitude",
        "longitude",
        *expected_feature_columns,
    ]
    combined = combined[ordered_columns]
    combined["date"] = pd.to_datetime(combined["date"], errors="coerce")
    return combined.sort_values("date").reset_index(drop=True)


def impute_with_monthly_climatology(
    dataframe: pd.DataFrame,
    *,
    date_column: str,
    feature_columns: list[str],
) -> pd.DataFrame:
    frame = dataframe.copy()
    frame["month"] = pd.to_datetime(frame[date_column]).dt.month
    for column in feature_columns:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
        frame[column] = frame.groupby("month")[column].transform(lambda values: values.fillna(values.mean()))
        frame[column] = frame[column].fillna(frame[column].mean())
    return frame.drop(columns=["month"])


def split_by_year(
    dataframe: pd.DataFrame,
    *,
    date_column: str,
) -> dict[str, pd.DataFrame]:
    dates = pd.to_datetime(dataframe[date_column], errors="coerce")
    train = dataframe.loc[(dates.dt.year >= 1993) & (dates.dt.year <= 2012)].copy()
    val = dataframe.loc[dates.dt.year == 2013].copy()
    test = dataframe.loc[(dates.dt.year >= 2014) & (dates.dt.year <= 2016)].copy()
    return {"train": train, "val": val, "test": test}


def scale_splits(
    splits: dict[str, pd.DataFrame],
    *,
    feature_columns: list[str],
) -> tuple[dict[str, pd.DataFrame], StandardScaler]:
    if splits["train"].empty:
        raise ValueError("Training split is empty after filtering. Check the feature-building inputs.")

    scaler = StandardScaler()
    scaled_splits: dict[str, pd.DataFrame] = {}
    scaler.fit(splits["train"][feature_columns])

    for split_name, frame in splits.items():
        scaled = frame.copy()
        if not frame.empty:
            scaled[feature_columns] = scaler.transform(frame[feature_columns])
        scaled["split"] = split_name
        scaled_splits[split_name] = scaled

    return scaled_splits, scaler


def save_dataframe_to_parquet_s3(
    dataframe: pd.DataFrame,
    *,
    bucket: str,
    key: str,
) -> str:
    buffer = BytesIO()
    dataframe.to_parquet(buffer, index=False)
    buffer.seek(0)
    get_s3_client().put_object(
        Bucket=bucket,
        Key=key,
        Body=buffer.getvalue(),
        ContentType="application/octet-stream",
    )
    return f"s3://{bucket}/{key}"


def save_json_to_s3(
    payload: dict[str, object],
    *,
    bucket: str,
    key: str,
) -> str:
    get_s3_client().put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(payload, indent=2).encode("utf-8"),
        ContentType="application/json",
    )
    return f"s3://{bucket}/{key}"


def persist_feature_outputs(
    scaled_splits: dict[str, pd.DataFrame],
    *,
    scaler: StandardScaler,
    feature_columns: list[str],
    output_dir: str | Path,
    upload_s3: bool,
    bucket: str,
) -> PersistedFeatureArtifacts:
    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)

    combined = pd.concat(scaled_splits.values(), ignore_index=True).sort_values("date").reset_index(drop=True)
    combined_local_path = destination / "model_b_features.parquet"
    combined.to_parquet(combined_local_path, index=False)

    split_local_paths: dict[str, Path] = {}
    for split_name, frame in scaled_splits.items():
        local_path = destination / f"model_b_{split_name}.parquet"
        frame.to_parquet(local_path, index=False)
        split_local_paths[split_name] = local_path

    stats_payload = {
        "feature_names": feature_columns,
        "target_depths": list(TARGET_DEPTHS),
        "train_row_count": int(len(scaled_splits["train"])),
        "val_row_count": int(len(scaled_splits["val"])),
        "test_row_count": int(len(scaled_splits["test"])),
        "scaler_mean": scaler.mean_.tolist(),
        "scaler_scale": scaler.scale_.tolist(),
    }
    stats_local_path = destination / "model_b_stats.json"
    stats_local_path.write_text(json.dumps(stats_payload, indent=2), encoding="utf-8")

    combined_s3_uri = None
    split_s3_uris = None
    stats_s3_uri = None
    if upload_s3:
        combined_s3_uri = save_dataframe_to_parquet_s3(combined, bucket=bucket, key=PROCESSED_MODEL_B_KEY)
        split_s3_uris = {}
        for split_name, frame in scaled_splits.items():
            split_s3_uris[split_name] = save_dataframe_to_parquet_s3(
                frame,
                bucket=bucket,
                key=PROCESSED_MODEL_B_SPLIT_KEYS[split_name],
            )
        stats_s3_uri = save_json_to_s3(stats_payload, bucket=bucket, key=PROCESSED_MODEL_B_STATS_KEY)

    return PersistedFeatureArtifacts(
        combined_local_path=combined_local_path,
        split_local_paths=split_local_paths,
        stats_local_path=stats_local_path,
        combined_s3_uri=combined_s3_uri,
        split_s3_uris=split_s3_uris,
        stats_s3_uri=stats_s3_uri,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build ReefPulse Model B features from CalCOFI Bottle and Cast data.")
    parser.add_argument("--bottle-local", help="Local path to the CalCOFI Bottle CSV.")
    parser.add_argument("--cast-local", help="Local path to the CalCOFI Cast CSV.")
    parser.add_argument("--bucket", default=settings.s3_bucket)
    parser.add_argument("--bottle-key", default=RAW_BOTTLE_KEY)
    parser.add_argument("--cast-key", default=RAW_CAST_KEY)
    parser.add_argument(
        "--output-dir",
        default=str(settings.project_root / "backend" / "training" / "model_b" / "artifacts" / "processed"),
        help="Directory for local parquet and stats artifacts.",
    )
    parser.add_argument("--skip-s3-upload", action="store_true", help="Build local outputs without uploading processed artifacts to S3.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    bottle_df, cast_df = load_calcofi_inputs(
        bottle_local_path=args.bottle_local,
        cast_local_path=args.cast_local,
        bucket=args.bucket,
        bottle_key=args.bottle_key,
        cast_key=args.cast_key,
    )

    feature_matrix = build_model_b_feature_matrix(bottle_df, cast_df)
    feature_columns = [f"{feature}_{depth}m" for feature in MODEL_B_FEATURES for depth in TARGET_DEPTHS]
    imputed = impute_with_monthly_climatology(feature_matrix, date_column="date", feature_columns=feature_columns)
    splits = split_by_year(imputed, date_column="date")
    scaled_splits, scaler = scale_splits(splits, feature_columns=feature_columns)
    artifacts = persist_feature_outputs(
        scaled_splits,
        scaler=scaler,
        feature_columns=feature_columns,
        output_dir=args.output_dir,
        upload_s3=not args.skip_s3_upload,
        bucket=args.bucket,
    )

    print(f"Saved combined local parquet: {artifacts.combined_local_path}")
    for split_name, local_path in artifacts.split_local_paths.items():
        print(f"Saved {split_name} local parquet: {local_path}")
    print(f"Saved local stats: {artifacts.stats_local_path}")

    if artifacts.combined_s3_uri is not None:
        print(f"Uploaded combined features to {artifacts.combined_s3_uri}")
    if artifacts.split_s3_uris is not None:
        for split_name, uri in artifacts.split_s3_uris.items():
            print(f"Uploaded {split_name} split to {uri}")
    if artifacts.stats_s3_uri is not None:
        print(f"Uploaded stats to {artifacts.stats_s3_uri}")


if __name__ == "__main__":
    main()
