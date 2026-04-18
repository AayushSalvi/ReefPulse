from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

import pandas as pd
from sklearn.preprocessing import StandardScaler

from app.clients.aws_clients import get_s3_client
from app.core.config import settings

TARGET_DEPTHS = (10, 50, 100, 200)
MODEL_B_FEATURES = ("temperature", "salinity", "oxygen", "chlorophyll")
PROCESSED_MODEL_B_KEY = "processed/model_b_features.parquet"


@dataclass
class FeatureBuilderConfig:
    date_column: str
    depth_column: str
    station_column: str
    feature_columns: dict[str, str]


def filter_post_1993_ctd_era(dataframe: pd.DataFrame, *, date_column: str) -> pd.DataFrame:
    frame = dataframe.copy()
    frame[date_column] = pd.to_datetime(frame[date_column], errors="coerce")
    frame = frame.dropna(subset=[date_column])
    return frame.loc[frame[date_column].dt.year >= 1993].copy()


def filter_standard_depths(
    dataframe: pd.DataFrame,
    *,
    depth_column: str,
    target_depths: tuple[int, ...] = TARGET_DEPTHS,
) -> pd.DataFrame:
    frame = dataframe.copy()
    frame[depth_column] = pd.to_numeric(frame[depth_column], errors="coerce")
    return frame.loc[frame[depth_column].isin(target_depths)].copy()


def pivot_feature_matrix(
    dataframe: pd.DataFrame,
    *,
    config: FeatureBuilderConfig,
    target_depths: tuple[int, ...] = TARGET_DEPTHS,
) -> pd.DataFrame:
    frame = filter_post_1993_ctd_era(dataframe, date_column=config.date_column)
    frame = filter_standard_depths(frame, depth_column=config.depth_column, target_depths=target_depths)

    wide_frames: list[pd.DataFrame] = []
    index_columns = [config.station_column, config.date_column]
    for feature_name, source_column in config.feature_columns.items():
        subset = frame[index_columns + [config.depth_column, source_column]].copy()
        subset = subset.rename(columns={source_column: "value"})
        pivoted = subset.pivot_table(
            index=index_columns,
            columns=config.depth_column,
            values="value",
            aggfunc="mean",
        )
        pivoted.columns = [f"{feature_name}_{int(depth)}m" for depth in pivoted.columns]
        wide_frames.append(pivoted)

    combined = pd.concat(wide_frames, axis=1).reset_index()
    combined[config.date_column] = pd.to_datetime(combined[config.date_column], errors="coerce")
    return combined.sort_values(config.date_column).reset_index(drop=True)


def impute_with_monthly_climatology(
    dataframe: pd.DataFrame,
    *,
    date_column: str,
    feature_columns: list[str],
) -> pd.DataFrame:
    frame = dataframe.copy()
    frame["month"] = pd.to_datetime(frame[date_column]).dt.month
    for column in feature_columns:
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
    scaler = StandardScaler()
    scaled_splits: dict[str, pd.DataFrame] = {}
    scaler.fit(splits["train"][feature_columns])

    for split_name, frame in splits.items():
        scaled = frame.copy()
        scaled[feature_columns] = scaler.transform(frame[feature_columns])
        scaled_splits[split_name] = scaled

    return scaled_splits, scaler


def save_processed_features_to_s3(
    dataframe: pd.DataFrame,
    *,
    bucket: str = settings.s3_bucket,
    key: str = PROCESSED_MODEL_B_KEY,
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
