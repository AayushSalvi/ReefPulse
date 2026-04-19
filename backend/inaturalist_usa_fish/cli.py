"""Command-line interface for fetching USA fish observations."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict

from inaturalist_usa_fish import fetch_fish_near
from inaturalist_usa_fish.config import DEFAULT_PLACE_ID, DEFAULT_US_PLACE_ID


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="List fish observations from iNaturalist near a lat/lon (United States by default).",
    )
    parser.add_argument("--lat", type=float, required=True, help="Center latitude (decimal degrees).")
    parser.add_argument("--lon", type=float, required=True, help="Center longitude (decimal degrees).")
    parser.add_argument(
        "--radius-km",
        type=float,
        default=25.0,
        help="Radius in kilometers used to build the search bounding box (default: 25).",
    )
    parser.add_argument(
        "--place-id",
        type=int,
        default=DEFAULT_PLACE_ID,
        help=(
            "iNaturalist place id limiting results "
            f"(default: {DEFAULT_PLACE_ID} California; US-wide: {DEFAULT_US_PLACE_ID})."
        ),
    )
    parser.add_argument(
        "--per-page",
        type=int,
        default=50,
        help="API per_page (default: 50, max 200).",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=10,
        help="Maximum API pages to fetch (default: 10).",
    )
    parser.add_argument(
        "--quality-grade",
        type=str,
        default="research",
        help='Quality grade filter: "research", "needs_id", "casual", or "any" to disable.',
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=None,
        help="If set, pretty-print JSON with this indent.",
    )
    parser.add_argument(
        "--json-out",
        type=str,
        default=None,
        help="If set, write JSON to this file path instead of stdout.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint."""
    parser = _build_parser()
    args = parser.parse_args(argv)

    quality = None if args.quality_grade.lower() == "any" else args.quality_grade

    records = fetch_fish_near(
        args.lat,
        args.lon,
        radius_km=args.radius_km,
        place_id=args.place_id,
        quality_grade=quality,
        per_page=args.per_page,
        max_pages=args.max_pages,
    )

    payload = [asdict(r) for r in records]
    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=args.indent)
            fh.write("\n")
    else:
        json.dump(payload, sys.stdout, indent=args.indent)
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
