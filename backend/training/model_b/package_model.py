from __future__ import annotations

import argparse
import tarfile
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Package Model B artifacts for SageMaker deployment.")
    parser.add_argument("--model-dir", required=True, help="Directory containing model_b.pt and model_b_stats.json.")
    parser.add_argument(
        "--output-tarball",
        default="artifacts/model_b.tar.gz",
        help="Output path for the SageMaker model tarball.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model_dir = Path(args.model_dir)
    output_tarball = Path(args.output_tarball)
    output_tarball.parent.mkdir(parents=True, exist_ok=True)

    required_files = [
        model_dir / "model_b.pt",
        model_dir / "model_b_stats.json",
        Path(__file__).with_name("inference.py"),
    ]
    missing_files = [path for path in required_files if not path.exists()]
    if missing_files:
        missing = ", ".join(str(path) for path in missing_files)
        raise FileNotFoundError(f"Cannot package Model B because these files are missing: {missing}")

    with tarfile.open(output_tarball, "w:gz") as archive:
        archive.add(model_dir / "model_b.pt", arcname="model_b.pt")
        archive.add(model_dir / "model_b_stats.json", arcname="model_b_stats.json")
        archive.add(Path(__file__).with_name("inference.py"), arcname="inference.py")

    print(f"Created SageMaker model package at {output_tarball}")


if __name__ == "__main__":
    main()
