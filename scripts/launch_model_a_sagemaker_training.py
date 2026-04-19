#!/usr/bin/env python3
"""
Launch a SageMaker PyTorch training job for ReefPulse Model A.

Prerequisites:
  pip install 'sagemaker>=2.220' boto3

Run inside SageMaker Studio (role auto) or locally with --role and AWS credentials.

Example (train.npz + val.npz in the same S3 prefix, e.g. model-a/):
  python scripts/launch_model_a_sagemaker_training.py \\
    --region us-east-1 \\
    --s3-train-channel s3://reefpulse-calcofi-data/model-a/ \\
    --output-path s3://reefpulse-calcofi-data/model-a/sagemaker-output/ \\
    --instance-type ml.g4dn.xlarge \\
    --epochs 20

The S3 prefix for --s3-train-channel must contain train.npz and val.npz.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import boto3


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--region", default=os.environ.get("AWS_REGION", "us-east-1"))
    parser.add_argument(
        "--role",
        default=None,
        help="IAM role ARN for SageMaker training. In Studio, omit to use execution role.",
    )
    parser.add_argument(
        "--s3-train-channel",
        required=True,
        help="S3 URI to folder containing train.npz and val.npz (trailing slash ok).",
    )
    parser.add_argument(
        "--output-path",
        required=True,
        help="S3 URI where job model.tar.gz and artifacts are written.",
    )
    parser.add_argument("--instance-type", default="ml.g4dn.xlarge")
    parser.add_argument("--job-name", default=None, help="Optional training job name prefix")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument(
        "--max-train-samples",
        type=int,
        default=0,
        help="0 = use all. Else random subset for faster jobs.",
    )
    parser.add_argument("--max-val-samples", type=int, default=0)
    parser.add_argument(
        "--framework-version",
        default="2.2.0",
        help="SageMaker PyTorch base image version (adjust if region lacks image).",
    )
    parser.add_argument("--py-version", default="py310", choices=("py310", "py311"))
    args = parser.parse_args()

    boto3.setup_default_session(region_name=args.region)

    from sagemaker.pytorch import PyTorch
    from sagemaker.session import Session

    try:
        from sagemaker import get_execution_role
    except ImportError as e:
        raise SystemExit("Install sagemaker: pip install 'sagemaker>=2.220'") from e

    sagemaker_session = Session(boto_session=boto3.Session(region_name=args.region))
    role = args.role or get_execution_role()

    repo_root = Path(__file__).resolve().parents[1]
    source_dir = str(repo_root / "backend")

    hps: dict[str, str] = {
        "epochs": str(args.epochs),
        "batch-size": str(args.batch_size),
        "lr": str(args.lr),
    }
    if args.max_train_samples > 0:
        hps["max-train-samples"] = str(args.max_train_samples)
    if args.max_val_samples > 0:
        hps["max-val-samples"] = str(args.max_val_samples)

    estimator = PyTorch(
        entry_point="train_sagemaker_model_a.py",
        source_dir=source_dir,
        role=role,
        framework_version=args.framework_version,
        py_version=args.py_version,
        instance_count=1,
        instance_type=args.instance_type,
        hyperparameters=hps,
        output_path=args.output_path.rstrip("/"),
        sagemaker_session=sagemaker_session,
        disable_profiler=True,
    )

    channel = args.s3_train_channel.rstrip("/") + "/"
    fit_kw: dict = {"inputs": {"training": channel}, "wait": True}
    if args.job_name:
        fit_kw["job_name"] = args.job_name
    estimator.fit(**fit_kw)
    print("Training job finished.")
    if estimator.latest_training_job:
        print("Job name:", estimator.latest_training_job.name)
    print("Output path:", args.output_path)


if __name__ == "__main__":
    main()
