from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
from io import BytesIO
import json
from pathlib import Path
import re
import tempfile
from typing import Iterable

import numpy as np
import pandas as pd
import xarray as xr

from app.clients.aws_clients import get_s3_client
from app.core.config import settings

RAW_MOORING_PREFIX = "raw/moorings"
PROCESSED_MOORING_KEY = "processed/model_b/moorings_state_vectors.parquet"
PROCESSED_MOORING_METADATA_KEY = "processed/model_b/moorings_state_vectors_metadata.json"
DEPTH_TARGETS = {"shallow": 15.0, "mid": 50.0, "deep": 150.0}
DEPTH_BOUNDS = {
    "shallow": (0.0, 25.0),
    "mid": (25.0, 100.0),
    "deep": (100.0, 300.0),
}
VARIABLE_MAP = {
    "CTD": {"TEMP": "temperature", "PSAL": "salinity"},
    "OXYGEN": {"DOX2": "oxygen"},
    "CHL": {"CHL": "chlorophyll"},
}
EXPECTED_FEATURE_COLUMNS = [
    f"{logical_name}_{level}"
    for logical_name in ("temperature", "salinity", "oxygen", "chlorophyll")
    for level in DEPTH_TARGETS
]
VALID_QC_CODES = {"0", "1", "2", "7", "8"}


@dataclass
class DeploymentMetadata:
    deployment_id: str
    site_code: str
    file_type: str
    source_file: str
    latitude: float | None
    longitude: float | None
    selected_depths: dict[str, float | None]


def parse_filename(path: str | Path) -> tuple[str, str, str]:
    name = Path(path).name
    match = re.match(r"OS_(CCE\d+)_(\d+)_D_([A-Z0-9]+)\.nc$", name, re.IGNORECASE)
    if not match:
        raise ValueError(f"Unexpected mooring filename format: {name}")
    site_code = match.group(1).upper()
    deployment_number = match.group(2)
    file_type = match.group(3).upper()
    deployment_id = f"{site_code}-{deployment_number}"
    return site_code, deployment_id, file_type


def classify_depth_level(depth: float) -> str | None:
    for level, (lower, upper) in DEPTH_BOUNDS.items():
        if lower <= depth < upper:
            return level
    return None


def normalize_coordinates(
    latitude: float | None,
    longitude: float | None,
) -> tuple[float | None, float | None]:
    if latitude is None or longitude is None:
        return latitude, longitude
    if abs(latitude) > 90 and abs(longitude) <= 90:
        return longitude, latitude
    return latitude, longitude


def list_local_files(input_dir: str | Path) -> list[Path]:
    return sorted(Path(input_dir).glob("*.nc"))


def list_s3_keys(bucket: str, prefix: str) -> list[str]:
    client = get_s3_client()
    paginator = client.get_paginator("list_objects_v2")
    keys: list[str] = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for item in page.get("Contents", []):
            key = item["Key"]
            if key.endswith(".nc"):
                keys.append(key)
    return sorted(keys)


def download_s3_files(bucket: str, keys: Iterable[str], *, destination_dir: str | Path) -> list[Path]:
    client = get_s3_client()
    destination_root = Path(destination_dir)
    destination_root.mkdir(parents=True, exist_ok=True)
    downloaded: list[Path] = []
    for key in keys:
        local_path = destination_root / Path(key).name
        client.download_file(bucket, key, str(local_path))
        downloaded.append(local_path)
    return downloaded


def normalize_qc_value(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, (bytes, bytearray)):
        try:
            value = value.decode("utf-8")
        except UnicodeDecodeError:
            value = value.decode("latin1", errors="ignore")
    if pd.isna(value):
        return None
    if isinstance(value, (np.integer, int)):
        return str(int(value))
    if isinstance(value, (np.floating, float)):
        numeric_value = float(value)
        return str(int(numeric_value)) if numeric_value.is_integer() else str(numeric_value)
    return str(value).strip()


def apply_qc_mask(data_array: xr.DataArray, qc_array: xr.DataArray | None) -> xr.DataArray:
    if qc_array is None:
        return data_array

    normalize = np.vectorize(normalize_qc_value)
    qc_values = normalize(qc_array.values)
    valid = np.isin(qc_values, [None, "", *sorted(VALID_QC_CODES)])
    return data_array.where(valid)


def select_depth_for_level(depths: np.ndarray, level: str) -> float | None:
    lower, upper = DEPTH_BOUNDS[level]
    candidates = [float(depth) for depth in depths if lower <= float(depth) < upper]
    if not candidates:
        return None
    target = DEPTH_TARGETS[level]
    return min(candidates, key=lambda depth: abs(depth - target))


def choose_best_depth(
    dataset: xr.Dataset,
    *,
    variable_name: str,
    level: str,
    qc_variable_name: str | None = None,
) -> float | None:
    depths = np.atleast_1d(dataset["DEPTH"].values).astype(float)
    lower, upper = DEPTH_BOUNDS[level]
    candidate_depths = [float(depth) for depth in depths if lower <= float(depth) < upper]
    if not candidate_depths:
        return None

    ranked_candidates: list[tuple[int, float, float]] = []
    target = DEPTH_TARGETS[level]
    for depth_value in candidate_depths:
        selected = dataset[variable_name].sel(DEPTH=depth_value).squeeze(drop=True)
        qc_selected = None
        if qc_variable_name and qc_variable_name in dataset:
            qc_selected = dataset[qc_variable_name].sel(DEPTH=depth_value).squeeze(drop=True)
        selected = apply_qc_mask(selected, qc_selected)
        valid_count = int(pd.notna(selected.values).sum())
        ranked_candidates.append((valid_count, abs(depth_value - target), depth_value))

    ranked_candidates.sort(key=lambda item: (-item[0], item[1], item[2]))
    return ranked_candidates[0][2]


def dataarray_to_series(
    dataset: xr.Dataset,
    *,
    variable_name: str,
    depth_value: float,
    qc_variable_name: str | None = None,
) -> pd.Series:
    data_array = dataset[variable_name]
    selected = data_array.sel(DEPTH=depth_value).squeeze(drop=True)
    qc_selected = None
    if qc_variable_name and qc_variable_name in dataset:
        qc_selected = dataset[qc_variable_name].sel(DEPTH=depth_value).squeeze(drop=True)
    selected = apply_qc_mask(selected, qc_selected)
    index = pd.to_datetime(selected["TIME"].values)
    return pd.Series(selected.values, index=index)


def extract_frame_from_file(path: Path) -> tuple[pd.DataFrame, DeploymentMetadata]:
    site_code, deployment_id, file_type = parse_filename(path)
    with xr.open_dataset(path) as dataset:
        latitude = None
        longitude = None
        if "LATITUDE" in dataset:
            latitude = float(np.atleast_1d(dataset["LATITUDE"].values)[0])
        if "LONGITUDE" in dataset:
            longitude = float(np.atleast_1d(dataset["LONGITUDE"].values)[0])
        latitude, longitude = normalize_coordinates(latitude, longitude)

        frame = pd.DataFrame({"time": pd.to_datetime(dataset["TIME"].values)})
        selected_depths: dict[str, float | None] = {}
        for source_variable, logical_name in VARIABLE_MAP.get(file_type, {}).items():
            qc_variable = f"{source_variable}_QC" if f"{source_variable}_QC" in dataset else None
            for level in DEPTH_TARGETS:
                depth_value = choose_best_depth(
                    dataset,
                    variable_name=source_variable,
                    level=level,
                    qc_variable_name=qc_variable,
                )
                column_name = f"{logical_name}_{level}"
                selected_depths[column_name] = depth_value
                if depth_value is None:
                    continue

                series = dataarray_to_series(
                    dataset,
                    variable_name=source_variable,
                    depth_value=depth_value,
                    qc_variable_name=qc_variable,
                )
                series_frame = series.rename(column_name).reset_index()
                series_frame.columns = ["time", column_name]
                frame = frame.merge(series_frame, on="time", how="left")

        frame["deployment_id"] = deployment_id
        frame["site_code"] = site_code
        frame["latitude"] = latitude
        frame["longitude"] = longitude

    metadata = DeploymentMetadata(
        deployment_id=deployment_id,
        site_code=site_code,
        file_type=file_type,
        source_file=path.name,
        latitude=latitude,
        longitude=longitude,
        selected_depths=selected_depths,
    )
    return frame.drop_duplicates(subset=["time"]).sort_values("time").reset_index(drop=True), metadata


def merge_deployment_frames(frames: list[pd.DataFrame]) -> pd.DataFrame:
    if not frames:
        return pd.DataFrame()

    deployment_id = frames[0]["deployment_id"].iloc[0]
    site_code = frames[0]["site_code"].iloc[0]
    latitude = next((frame["latitude"].iloc[0] for frame in frames if pd.notna(frame["latitude"].iloc[0])), None)
    longitude = next((frame["longitude"].iloc[0] for frame in frames if pd.notna(frame["longitude"].iloc[0])), None)

    master_times = pd.Index(sorted(set().union(*[frame["time"].tolist() for frame in frames])))
    merged = pd.DataFrame({"time": master_times})
    for frame in frames:
        value_columns = [column for column in frame.columns if column not in {"time", "deployment_id", "site_code", "latitude", "longitude"}]
        if not value_columns:
            continue
        merged = pd.merge_asof(
            merged.sort_values("time"),
            frame[["time", *value_columns]].sort_values("time"),
            on="time",
            direction="nearest",
            tolerance=pd.Timedelta("6h"),
        )

    merged["deployment_id"] = deployment_id
    merged["site_code"] = site_code
    merged["latitude"] = latitude
    merged["longitude"] = longitude

    for column in EXPECTED_FEATURE_COLUMNS:
        if column not in merged:
            merged[column] = np.nan

    merged = merged.loc[merged[EXPECTED_FEATURE_COLUMNS].notna().any(axis=1)].copy()
    ordered_columns = [
        "time",
        *EXPECTED_FEATURE_COLUMNS,
        "deployment_id",
        "site_code",
        "latitude",
        "longitude",
    ]
    return merged[ordered_columns].sort_values("time").reset_index(drop=True)


def build_state_vectors(files: Iterable[Path]) -> tuple[pd.DataFrame, list[dict[str, object]]]:
    grouped_frames: dict[str, list[pd.DataFrame]] = {}
    metadata_records: list[dict[str, object]] = []

    for path in files:
        frame, metadata = extract_frame_from_file(path)
        grouped_frames.setdefault(metadata.deployment_id, []).append(frame)
        metadata_records.append(asdict(metadata))

    state_vectors = [
        state_vector
        for frames in grouped_frames.values()
        if not (state_vector := merge_deployment_frames(frames)).empty
    ]
    combined = pd.concat(state_vectors, ignore_index=True) if state_vectors else pd.DataFrame()
    if not combined.empty:
        combined = combined.sort_values(["deployment_id", "time"]).reset_index(drop=True)
    return combined, metadata_records


def save_dataframe_to_s3(dataframe: pd.DataFrame, *, bucket: str, key: str) -> str:
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


def save_json_to_s3(payload: dict[str, object], *, bucket: str, key: str) -> str:
    get_s3_client().put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(payload, indent=2).encode("utf-8"),
        ContentType="application/json",
    )
    return f"s3://{bucket}/{key}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Process CCE mooring raw netCDF files into Model B state vectors.")
    parser.add_argument("--input-dir", help="Local directory containing mooring netCDF files.")
    parser.add_argument("--bucket", default=settings.s3_bucket)
    parser.add_argument("--s3-prefix", default=RAW_MOORING_PREFIX)
    parser.add_argument(
        "--output-dir",
        default=str(settings.project_root / "backend" / "training" / "model_b" / "artifacts" / "mooring"),
        help="Directory for local mooring parquet artifacts.",
    )
    parser.add_argument("--processed-key", default=PROCESSED_MOORING_KEY)
    parser.add_argument("--metadata-key", default=PROCESSED_MOORING_METADATA_KEY)
    parser.add_argument("--skip-s3-upload", action="store_true", help="Write local outputs only.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.input_dir:
        files = list_local_files(args.input_dir)
    else:
        with tempfile.TemporaryDirectory() as temp_dir:
            keys = list_s3_keys(args.bucket, args.s3_prefix)
            files = download_s3_files(args.bucket, keys, destination_dir=temp_dir)
            _process_and_persist(files, args)
            return

    _process_and_persist(files, args)


def _process_and_persist(files: list[Path], args: argparse.Namespace) -> None:
    if not files:
        raise FileNotFoundError("No mooring netCDF files were found to process.")

    state_vectors, metadata_records = build_state_vectors(files)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    local_parquet_path = output_dir / "mooring_state_vectors.parquet"
    local_metadata_path = output_dir / "mooring_state_vectors_metadata.json"
    state_vectors.to_parquet(local_parquet_path, index=False)
    metadata_payload = {
        "row_count": int(len(state_vectors)),
        "deployments": sorted(state_vectors["deployment_id"].unique().tolist()) if not state_vectors.empty else [],
        "records": metadata_records,
    }
    local_metadata_path.write_text(json.dumps(metadata_payload, indent=2), encoding="utf-8")

    print(f"Saved local mooring state vectors: {local_parquet_path}")
    print(f"Saved local mooring metadata: {local_metadata_path}")

    if not args.skip_s3_upload:
        parquet_uri = save_dataframe_to_s3(state_vectors, bucket=args.bucket, key=args.processed_key)
        metadata_uri = save_json_to_s3(metadata_payload, bucket=args.bucket, key=args.metadata_key)
        print(f"Uploaded mooring state vectors to {parquet_uri}")
        print(f"Uploaded mooring metadata to {metadata_uri}")


if __name__ == "__main__":
    main()
