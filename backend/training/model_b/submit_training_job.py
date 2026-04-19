from __future__ import annotations

import argparse
from pathlib import Path

import sagemaker
from sagemaker.pytorch import PyTorch


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Submit a SageMaker training job for ReefPulse Model B.")
    parser.add_argument("--role-arn", required=True, help="IAM role ARN for SageMaker training.")
    parser.add_argument("--output-s3-uri", required=True, help="S3 prefix for training outputs.")
    parser.add_argument("--train-s3-uri", required=True, help="S3 URI to the training parquet directory.")
    parser.add_argument("--validation-s3-uri", required=True, help="S3 URI to the validation parquet directory.")
    parser.add_argument("--test-s3-uri", help="Optional S3 URI to the test parquet directory.")
    parser.add_argument("--instance-type", default="ml.m5.large")
    parser.add_argument("--instance-count", type=int, default=1)
    parser.add_argument("--framework-version", default="2.3")
    parser.add_argument("--py-version", default="py311")
    parser.add_argument("--job-name", help="Optional explicit SageMaker training job name.")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--latent-dim", type=int, default=4)
    parser.add_argument("--hidden-dim", type=int, default=32)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    session = sagemaker.Session()
    source_dir = str(Path(__file__).resolve().parent)

    estimator = PyTorch(
        entry_point="train.py",
        source_dir=source_dir,
        role=args.role_arn,
        framework_version=args.framework_version,
        py_version=args.py_version,
        instance_count=args.instance_count,
        instance_type=args.instance_type,
        output_path=args.output_s3_uri,
        hyperparameters={
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "learning_rate": args.learning_rate,
            "latent_dim": args.latent_dim,
            "hidden_dim": args.hidden_dim,
        },
        sagemaker_session=session,
    )

    inputs = {
        "train": args.train_s3_uri,
        "validation": args.validation_s3_uri,
    }
    if args.test_s3_uri:
        inputs["test"] = args.test_s3_uri

    fit_kwargs: dict[str, object] = {"inputs": inputs}
    if args.job_name:
        fit_kwargs["job_name"] = args.job_name

    estimator.fit(**fit_kwargs)
    print(f"Submitted SageMaker training job for Model B from {source_dir}")


if __name__ == "__main__":
    main()
