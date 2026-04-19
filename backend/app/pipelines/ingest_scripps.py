from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path

import pandas as pd

from app.clients.aws_clients import get_s3_client
from app.core.config import settings

RAW_CALCOFI_KEY = "raw/calcofi/bottle_db.csv"
PROCESSED_CALCOFI_KEY = "processed/calcofi/bottle_db.parquet"


def upload_local_calcofi_csv(
    local_path: str | Path,
    *,
    bucket: str = settings.s3_bucket,
    key: str = RAW_CALCOFI_KEY,
) -> str:
    local_file = Path(local_path)
    if not local_file.exists():
        raise FileNotFoundError(f"CalCOFI CSV not found: {local_file}")

    get_s3_client().upload_file(str(local_file), bucket, key)
    return f"s3://{bucket}/{key}"


def load_csv_from_s3(
    *,
    bucket: str = settings.s3_bucket,
    key: str = RAW_CALCOFI_KEY,
    **read_csv_kwargs,
) -> pd.DataFrame:
    response = get_s3_client().get_object(Bucket=bucket, Key=key)
    return pd.read_csv(response["Body"], **read_csv_kwargs)


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


def convert_raw_calcofi_to_parquet(
    *,
    bucket: str = settings.s3_bucket,
    source_key: str = RAW_CALCOFI_KEY,
    target_key: str = PROCESSED_CALCOFI_KEY,
) -> str:
    dataframe = load_csv_from_s3(bucket=bucket, key=source_key)
    return save_dataframe_to_parquet_s3(dataframe, bucket=bucket, key=target_key)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload or convert CalCOFI bottle data for ReefPulse.")
    parser.add_argument("--upload-local", help="Local CSV file to upload into the raw S3 zone.")
    parser.add_argument("--bucket", default=settings.s3_bucket)
    parser.add_argument("--raw-key", default=RAW_CALCOFI_KEY)
    parser.add_argument("--processed-key", default=PROCESSED_CALCOFI_KEY)
    parser.add_argument(
        "--convert-to-parquet",
        action="store_true",
        help="Read the raw CSV from S3 and write a parquet copy to the processed zone.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.upload_local:
        destination = upload_local_calcofi_csv(
            args.upload_local,
            bucket=args.bucket,
            key=args.raw_key,
        )
        print(f"Uploaded CSV to {destination}")

    if args.convert_to_parquet:
        destination = convert_raw_calcofi_to_parquet(
            bucket=args.bucket,
            source_key=args.raw_key,
            target_key=args.processed_key,
        )
        print(f"Wrote parquet dataset to {destination}")

    if not args.upload_local and not args.convert_to_parquet:
        print("No action requested. Use --upload-local and/or --convert-to-parquet.")


if __name__ == "__main__":
    main()
