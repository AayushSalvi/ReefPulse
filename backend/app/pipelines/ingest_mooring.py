from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
import json
from pathlib import Path
import re
from typing import Iterable
from urllib.parse import urlparse

import httpx

from app.clients.aws_clients import get_s3_client
from app.core.config import settings

RAW_MOORING_PREFIX = "raw/moorings"


@dataclass(frozen=True)
class MooringDownloadSpec:
    site: str
    deployment: str
    data_type: str
    url: str

    @property
    def filename(self) -> str:
        return Path(urlparse(self.url).path).name


DEFAULT_SAMPLE_SPECS = [
    MooringDownloadSpec(
        site="CCE1",
        deployment="CCE1-17",
        data_type="ctd",
        url="https://dods.ndbc.noaa.gov/thredds/fileServer/oceansites/DATA/CCE1/OS_CCE1_17_D_CTD.nc",
    ),
    MooringDownloadSpec(
        site="CCE1",
        deployment="CCE1-17",
        data_type="oxygen",
        url="https://dods.ndbc.noaa.gov/thredds/fileServer/oceansites/DATA/CCE1/OS_CCE1_17_D_OXYGEN.nc",
    ),
    MooringDownloadSpec(
        site="CCE1",
        deployment="CCE1-16",
        data_type="chlorophyll",
        url="https://dods.ndbc.noaa.gov/thredds/fileServer/oceansites/DATA/CCE1/OS_CCE1_16_D_CHL.nc",
    ),
    MooringDownloadSpec(
        site="CCE2",
        deployment="CCE2-16",
        data_type="ctd",
        url="https://www.ncei.noaa.gov/thredds-ocean/fileServer/ndbc/oceansites/DATA/CCE2/OS_CCE2_16_D_CTD.nc",
    ),
    MooringDownloadSpec(
        site="CCE2",
        deployment="CCE2-16",
        data_type="oxygen",
        url="https://www.ncei.noaa.gov/thredds-ocean/fileServer/ndbc/oceansites/DATA/CCE2/OS_CCE2_16_D_OXYGEN.nc",
    ),
    MooringDownloadSpec(
        site="CCE2",
        deployment="CCE2-16",
        data_type="chlorophyll",
        url="https://www.ncei.noaa.gov/thredds-ocean/fileServer/ndbc/oceansites/DATA/CCE2/OS_CCE2_16_D_CHL.nc",
    ),
]


def infer_site_from_filename(filename: str) -> str:
    match = re.match(r"OS_(CCE\d+)_\d+_D_[A-Z0-9]+\.nc$", filename, re.IGNORECASE)
    if not match:
        raise ValueError(f"Cannot infer mooring site from filename: {filename}")
    return match.group(1).upper()


def s3_key_for_file(filename: str, *, prefix: str = RAW_MOORING_PREFIX) -> str:
    site = infer_site_from_filename(filename).lower()
    return f"{prefix}/{site}/{filename}"


def download_file(url: str, destination: Path, *, overwrite: bool = False) -> Path:
    if destination.exists() and not overwrite:
        return destination

    destination.parent.mkdir(parents=True, exist_ok=True)
    with httpx.stream("GET", url, follow_redirects=True, timeout=120.0) as response:
        response.raise_for_status()
        with destination.open("wb") as handle:
            for chunk in response.iter_bytes():
                handle.write(chunk)
    return destination


def download_specs(
    specs: Iterable[MooringDownloadSpec],
    *,
    output_dir: str | Path,
    overwrite: bool = False,
) -> list[Path]:
    destination_root = Path(output_dir)
    destination_root.mkdir(parents=True, exist_ok=True)

    downloaded: list[Path] = []
    for spec in specs:
        destination = destination_root / spec.filename
        downloaded.append(download_file(spec.url, destination, overwrite=overwrite))
    return downloaded


def upload_local_mooring_files(
    paths: Iterable[str | Path],
    *,
    bucket: str = settings.s3_bucket,
    prefix: str = RAW_MOORING_PREFIX,
) -> list[str]:
    client = get_s3_client()
    uploaded_uris: list[str] = []
    for path in paths:
        local_path = Path(path)
        if not local_path.exists():
            raise FileNotFoundError(f"Mooring file not found: {local_path}")

        key = s3_key_for_file(local_path.name, prefix=prefix)
        client.upload_file(str(local_path), bucket, key)
        uploaded_uris.append(f"s3://{bucket}/{key}")
    return uploaded_uris


def write_manifest(
    specs: Iterable[MooringDownloadSpec],
    *,
    output_dir: str | Path,
    bucket: str | None = None,
    prefix: str = RAW_MOORING_PREFIX,
) -> Path:
    destination = Path(output_dir) / "mooring_manifest.json"
    payload = []
    for spec in specs:
        item = asdict(spec)
        item["filename"] = spec.filename
        if bucket is not None:
            item["s3_uri"] = f"s3://{bucket}/{s3_key_for_file(spec.filename, prefix=prefix)}"
        payload.append(item)
    destination.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return destination


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download and upload CCE mooring raw netCDF files.")
    parser.add_argument(
        "--output-dir",
        default=str(settings.project_root / "data" / "moorings" / "sample"),
        help="Directory to store downloaded mooring netCDF files.",
    )
    parser.add_argument("--bucket", default=settings.s3_bucket)
    parser.add_argument("--prefix", default=RAW_MOORING_PREFIX)
    parser.add_argument("--download-sample", action="store_true", help="Download the validated CCE sample file set.")
    parser.add_argument("--upload-s3", action="store_true", help="Upload local files in the output directory to S3.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing local files when downloading.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    downloaded_paths: list[Path] = []
    if args.download_sample:
        downloaded_paths = download_specs(DEFAULT_SAMPLE_SPECS, output_dir=output_dir, overwrite=args.overwrite)
        manifest_path = write_manifest(DEFAULT_SAMPLE_SPECS, output_dir=output_dir, bucket=args.bucket, prefix=args.prefix)
        print(f"Downloaded {len(downloaded_paths)} sample files into {output_dir}")
        print(f"Wrote manifest: {manifest_path}")

    if args.upload_s3:
        local_files = sorted(output_dir.glob("*.nc"))
        uploaded_uris = upload_local_mooring_files(local_files, bucket=args.bucket, prefix=args.prefix)
        for uri in uploaded_uris:
            print(f"Uploaded {uri}")

    if not args.download_sample and not args.upload_s3:
        print("No action requested. Use --download-sample and/or --upload-s3.")


if __name__ == "__main__":
    main()
