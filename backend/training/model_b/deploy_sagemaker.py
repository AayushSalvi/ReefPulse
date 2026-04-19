from __future__ import annotations

import argparse

import sagemaker
from sagemaker.pytorch import PyTorchModel


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy ReefPulse Model B to a SageMaker endpoint.")
    parser.add_argument("--role-arn", required=True, help="IAM role ARN for SageMaker deployment.")
    parser.add_argument("--model-data", required=True, help="S3 URI to the packaged model tarball.")
    parser.add_argument("--endpoint-name", required=True, help="Name of the SageMaker endpoint to create.")
    parser.add_argument("--instance-type", default="ml.t2.medium")
    parser.add_argument("--framework-version", default="2.3")
    parser.add_argument("--py-version", default="py311")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    session = sagemaker.Session()

    model = PyTorchModel(
        model_data=args.model_data,
        role=args.role_arn,
        framework_version=args.framework_version,
        py_version=args.py_version,
        entry_point="inference.py",
        source_dir=".",
        sagemaker_session=session,
    )

    predictor = model.deploy(
        initial_instance_count=1,
        instance_type=args.instance_type,
        endpoint_name=args.endpoint_name,
    )
    print(f"Deployed Model B to endpoint {predictor.endpoint_name}")


if __name__ == "__main__":
    main()
